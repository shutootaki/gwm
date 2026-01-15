import { useCallback, useMemo } from 'react';
import { execSync } from 'child_process';
import { join } from 'path';
import { loadConfig } from '../config.js';
import {
  getRepositoryName,
  getMainWorktreePath,
  getIgnoredFiles,
  copyFiles,
  getRepoRoot,
} from '../utils/git.js';
import {
  detectVirtualEnvs,
  suggestSetupCommands,
  getVirtualEnvExcludePatterns,
} from '../utils/virtualenv.js';
import { escapeShellArg } from '../utils/shell.js';
import { openWithEditor } from '../utils/editor.js';
import { formatErrorForDisplay } from '../utils/index.js';
import { runPostCreateHooks } from './runner/index.js';
import { tryWriteCwdFile } from '../utils/cwdFile.js';

interface UseWorktreeOptions {
  fromBranch?: string;
  openCode?: boolean;
  openCursor?: boolean;
  outputPath?: boolean;
  skipHooks?: boolean;
  onSuccess?: (data: { path: string; actions: string[] }) => void;
  onError?: (message: string) => void;
  onHooksStart?: () => void;
}

export function useWorktree({
  fromBranch,
  openCode = false,
  openCursor = false,
  outputPath = false,
  skipHooks = false,
  onSuccess,
  onError,
  onHooksStart,
}: UseWorktreeOptions) {
  const config = useMemo(() => loadConfig(), []);

  const createWorktree = useCallback(
    async (branch: string, isRemote: boolean) => {
      try {
        const repoName = getRepositoryName();
        const sanitizedBranch = branch.replace(/\//g, '-');
        const worktreePath = join(
          config.worktree_base_path,
          repoName,
          sanitizedBranch
        );

        let command: string;

        // 仮想環境隔離機能が有効かどうか判定
        // パーサーが mode → isolate_virtual_envs に正規化済み
        const isIsolationEnabled =
          config.virtual_env_handling?.isolate_virtual_envs ?? false;

        // まずローカルブランチの存在を確認（isRemote= true の場合も含む）
        const localExists = (() => {
          try {
            execSync(
              `git show-ref --verify --quiet ${escapeShellArg(`refs/heads/${branch}`)}`
            );
            return true;
          } catch {
            return false;
          }
        })();

        if (localExists) {
          // 既存ブランチをそのまま利用
          command = `git worktree add ${escapeShellArg(worktreePath)} ${escapeShellArg(branch)}`;
        } else if (isRemote) {
          // リモートブランチからチェックアウト
          command = `git worktree add ${escapeShellArg(worktreePath)} -b ${escapeShellArg(branch)} ${escapeShellArg(`origin/${branch}`)}`;
        } else {
          // 新規ローカルブランチとして baseBranch から作成
          const baseBranch = fromBranch || config.main_branches[0];
          command = `git worktree add ${escapeShellArg(worktreePath)} -b ${escapeShellArg(branch)} ${escapeShellArg(baseBranch)}`;
        }

        // パス出力モード（デフォルト）かつエディタ起動なしの場合、gitの出力を抑制
        const shouldSuppressGitOutput = outputPath && !openCode && !openCursor;
        execSync(command, {
          stdio: shouldSuppressGitOutput ? 'pipe' : 'inherit',
        });

        const actions: string[] = [];

        // gitignoreされたファイルのコピー処理
        if (config.copy_ignored_files?.enabled) {
          const mainWorktreePath = getMainWorktreePath();

          if (mainWorktreePath && mainWorktreePath !== worktreePath) {
            const ignoredFiles = getIgnoredFiles(
              mainWorktreePath,
              config.copy_ignored_files.patterns ?? [],
              [
                ...(config.copy_ignored_files.exclude_patterns ?? []),
                ...(isIsolationEnabled ? getVirtualEnvExcludePatterns() : []),
              ],
              isIsolationEnabled
            );

            if (ignoredFiles.length > 0) {
              const { copied, skippedVirtualEnvs, skippedOversize } =
                await copyFiles(mainWorktreePath, worktreePath, ignoredFiles);

              if (copied.length > 0) {
                actions.push(
                  `Copied ${copied.length} ignored file(s): ${copied.join(', ')}`
                );
              }

              if (skippedVirtualEnvs.length > 0) {
                actions.push(
                  `Skipped virtual environment(s): ${skippedVirtualEnvs.join(', ')}`
                );
              }

              if (skippedOversize.length > 0) {
                actions.push(
                  `Skipped oversize file(s): ${skippedOversize.join(', ')}`
                );
              }
            }
          }
        }

        // 仮想環境の検出とセットアップ提案（隔離有効時のみ）
        if (isIsolationEnabled) {
          const mainPath = getMainWorktreePath();
          if (mainPath) {
            const detectedEnvs = detectVirtualEnvs(mainPath);
            if (detectedEnvs.length > 0) {
              actions.push(
                '',
                '📦 Virtual environments detected in the source worktree:',
                ...detectedEnvs.map(
                  (env) => `  - ${env.language}: ${env.path}`
                ),
                '',
                '💡 To set up your development environment, run:',
                ...suggestSetupCommands(detectedEnvs)
              );
            }
          }
        }

        const hasEditorOption = openCode || openCursor;

        // エディタ起動
        if (openCode) {
          const ok = openWithEditor(worktreePath, 'code');
          actions.push(
            ok ? 'VS Code opened' : 'VS Code failed to open (not installed?)'
          );
        }
        if (openCursor) {
          const ok = openWithEditor(worktreePath, 'cursor');
          actions.push(
            ok ? 'Cursor opened' : 'Cursor failed to open (not installed?)'
          );
        }

        // post_create hook の実行（--skip-hooks が指定されていない場合）
        if (!skipHooks) {
          onHooksStart?.();
          const hookContext = {
            worktreePath,
            branchName: branch,
            repoRoot: getRepoRoot(),
            repoName,
          };

          const hookResult = await runPostCreateHooks(config, hookContext);

          if (!hookResult.success) {
            actions.push(`Hook failed: ${hookResult.failedCommand}`);
          } else if (hookResult.executedCount > 0) {
            actions.push(
              `Executed ${hookResult.executedCount} post_create hook(s)`
            );
          }
        }

        // デフォルト動作（outputPath=true、エディタ起動なし）: パス出力のみで終了
        const shouldOutputPathOnly = outputPath && !hasEditorOption;
        if (shouldOutputPathOnly) {
          if (actions.length > 0) {
            console.error(actions.join('\n'));
          }
          try {
            const wrote = tryWriteCwdFile(worktreePath);
            if (!wrote) {
              console.log(worktreePath);
            }
          } catch (e) {
            console.error(
              `Warning: Failed to write cwd file: ${formatErrorForDisplay(e)}`
            );
            console.log(worktreePath);
          }
          process.exit(0);
        }

        onSuccess?.({ path: worktreePath, actions });
      } catch (err) {
        onError?.(formatErrorForDisplay(err));
      }
    },
    [
      config,
      fromBranch,
      openCode,
      openCursor,
      outputPath,
      skipHooks,
      onSuccess,
      onError,
      onHooksStart,
    ]
  );

  return { createWorktree };
}
