import { useCallback, useMemo } from 'react';
import { execSync, spawnSync } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';
import { loadConfig } from '../config.js';
import {
  getRepositoryName,
  getMainWorktreePath,
  getIgnoredFiles,
  copyFiles,
  isPythonProject,
} from '../utils/git.js';
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
    (branch: string, isRemote: boolean) => {
      try {
        const repoName = getRepositoryName();
        const sanitizedBranch = branch.replace(/\//g, '-');
        const worktreePath = join(
          config.worktree_base_path,
          repoName,
          sanitizedBranch
        );

        let command: string;

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
              config.copy_ignored_files.exclude_patterns
            );

            if (ignoredFiles.length > 0) {
              const copiedFiles = copyFiles(
                mainWorktreePath,
                worktreePath,
                ignoredFiles
              );
              if (copiedFiles.length > 0) {
                actions.push(
                  `Copied ${copiedFiles.length} ignored file(s): ${copiedFiles.join(', ')}`
                );
              }
            }
          }
        }

        // Pythonプロジェクトの場合、venv再作成の提案を表示
        if (
          config.python?.auto_detect &&
          config.python?.suggest_venv_recreate &&
          isPythonProject(worktreePath)
        ) {
          actions.push(
            '💡 Python project detected! Consider recreating virtual environment:'
          );

          // プロジェクトファイルに基づいて適切なコマンドを提案
          const mainWorktreePath = getMainWorktreePath();
          if (mainWorktreePath) {
            if (
              existsSync(join(mainWorktreePath, 'pyproject.toml')) ||
              existsSync(join(mainWorktreePath, 'poetry.lock'))
            ) {
              actions.push('   • poetry install');
            } else if (existsSync(join(mainWorktreePath, 'Pipfile'))) {
              actions.push('   • pipenv install');
            } else if (existsSync(join(mainWorktreePath, 'requirements.txt'))) {
              actions.push(
                '   • python -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt'
              );
            } else {
              actions.push('   • python -m venv .venv');
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
