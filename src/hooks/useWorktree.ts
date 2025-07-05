import { useCallback, useMemo } from 'react';
import { execSync, spawnSync } from 'child_process';
import { join } from 'path';
import { loadConfig } from '../config.js';
import {
  getRepositoryName,
  getMainWorktreePath,
  getIgnoredFiles,
  copyFiles,
} from '../utils/git.js';
import {
  detectVirtualEnvs,
  suggestSetupCommands,
  getVirtualEnvExcludePatterns,
} from '../utils/virtualenv.js';
import { escapeShellArg } from '../utils/shell.js';
import { openWithEditor } from '../utils/editor.js';
import { formatErrorForDisplay } from '../utils/index.js';

interface UseWorktreeOptions {
  fromBranch?: string;
  openCode?: boolean;
  openCursor?: boolean;
  outputPath?: boolean;
  onSuccess?: (data: { path: string; actions: string[] }) => void;
  onError?: (message: string) => void;
}

export function useWorktree({
  fromBranch,
  openCode = false,
  openCursor = false,
  outputPath = false,
  onSuccess,
  onError,
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

        // 仮想環境隔離機能が有効かどうか判定（後方互換）
        const isIsolationEnabled = (() => {
          const veh = config.virtual_env_handling;
          if (!veh) return false;
          if (typeof veh.isolate_virtual_envs === 'boolean')
            return veh.isolate_virtual_envs;
          return veh.mode === 'skip';
        })();

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

        execSync(command);

        const actions: string[] = [];

        // gitignoreされたファイルのコピー処理
        if (config.copy_ignored_files?.enabled) {
          const mainWorktreePath = getMainWorktreePath();

          if (mainWorktreePath && mainWorktreePath !== worktreePath) {
            const ignoredFiles = getIgnoredFiles(
              mainWorktreePath,
              config.copy_ignored_files.patterns,
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

        if (outputPath) {
          const userShell =
            process.env.SHELL ||
            (process.platform === 'win32'
              ? process.env.COMSPEC || 'cmd.exe'
              : '/bin/bash');

          spawnSync(userShell, {
            cwd: worktreePath,
            stdio: 'inherit',
            env: process.env,
          });

          // サブシェル終了後に CLI も終了
          process.exit(0);
        }

        onSuccess?.({ path: worktreePath, actions });
      } catch (err) {
        onError?.(formatErrorForDisplay(err));
      }
    },
    [config, fromBranch, openCode, openCursor, outputPath, onSuccess, onError]
  );

  return { createWorktree };
}
