import { useCallback } from 'react';
import { execSync, spawnSync } from 'child_process';
import { join } from 'path';
import { loadConfig } from '../config.js';
import { getRepositoryName } from '../utils/git.js';
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
  const config = loadConfig();

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

        if (isRemote) {
          // リモートブランチから作成
          command = `git worktree add ${escapeShellArg(worktreePath)} -b ${escapeShellArg(branch)} ${escapeShellArg(`origin/${branch}`)}`;
        } else {
          // ローカルブランチまたは新規ブランチ
          const baseBranch = fromBranch || config.main_branches[0];

          try {
            execSync(
              `git show-ref --verify --quiet ${escapeShellArg(`refs/heads/${branch}`)}`
            );
            // 既存ローカルブランチ
            command = `git worktree add ${escapeShellArg(worktreePath)} ${escapeShellArg(branch)}`;
          } catch {
            // 新規ブランチ
            command = `git worktree add ${escapeShellArg(worktreePath)} -b ${escapeShellArg(branch)} ${escapeShellArg(baseBranch)}`;
          }
        }

        execSync(command);

        const actions: string[] = [];

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
