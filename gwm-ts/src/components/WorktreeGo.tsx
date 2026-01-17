import React, { useState } from 'react';
import { Text, Box } from 'ink';
import { execSync, spawnSync } from 'child_process';
import { WorktreeSelector } from './WorktreeSelector.js';
import { formatErrorForDisplay } from '../utils/index.js';
import { escapeShellArg } from '../utils/shell.js';
import { tryWriteCwdFile } from '../utils/cwdFile.js';

interface WorktreeGoProps {
  query?: string;
  openCode?: boolean;
  openCursor?: boolean;
}

export const WorktreeGo: React.FC<WorktreeGoProps> = ({
  query,
  openCode = false,
  openCursor = false,
}) => {
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSelect = (worktree: { path: string; branch: string }) => {
    if (openCode) {
      try {
        // codeコマンドが存在するかチェック
        execSync('which code', { stdio: 'ignore' });

        // VS Codeでディレクトリを開く（適切にエスケープ）
        execSync(`code ${escapeShellArg(worktree.path)}`, { stdio: 'inherit' });

        setSuccess(`Opened ${worktree.branch} in Editor`);
        setTimeout(() => process.exit(0), 1000);
      } catch (err) {
        if (err instanceof Error && err.message.includes('which code')) {
          setError(
            'Editor command "code" not found. Please install Editor and add it to your PATH.'
          );
        } else {
          setError(formatErrorForDisplay(err));
        }
      }
    } else if (openCursor) {
      try {
        // cursor コマンドが存在するかチェック
        execSync('which cursor', { stdio: 'ignore' });

        execSync(`cursor ${escapeShellArg(worktree.path)}`, {
          stdio: 'inherit',
        });

        setSuccess(`Opened ${worktree.branch} in Cursor`);
        setTimeout(() => process.exit(0), 1000);
      } catch (err) {
        if (err instanceof Error && err.message.includes('which cursor')) {
          setError(
            'Cursor command "cursor" not found. Please install Cursor and add it to your PATH.'
          );
        } else {
          setError(formatErrorForDisplay(err));
        }
      }
    } else {
      // Shell integration: write cwd file for parent-shell cd (avoid subshell)
      try {
        if (tryWriteCwdFile(worktree.path)) {
          process.exit(0);
        }
      } catch (err) {
        console.error(formatErrorForDisplay(err));
        process.exit(1);
      }

      // Fallback: launch a subshell in the selected directory
      try {
        const userShell =
          process.env.SHELL ||
          (process.platform === 'win32'
            ? process.env.COMSPEC || 'cmd.exe'
            : '/bin/bash');

        spawnSync(userShell, {
          cwd: worktree.path,
          stdio: 'inherit',
          env: process.env,
        });
        process.exit(0);
      } catch (err) {
        console.error(formatErrorForDisplay(err));
        process.exit(1);
      }
    }
  };

  const handleCancel = () => {
    // Exit without output
    process.exit(0);
  };

  const placeholderText = (() => {
    if (openCode) return 'Select a worktree to open in VS Code:';
    if (openCursor) return 'Select a worktree to open in Cursor:';
    return 'Select a worktree to go to:';
  })();

  if (success) {
    return (
      <Box>
        <Text color="green">✓ {success}</Text>
      </Box>
    );
  }

  if (error) {
    return (
      <Box>
        <Text color="red">✗ Error: {error}</Text>
      </Box>
    );
  }

  return (
    <WorktreeSelector
      onSelect={handleSelect}
      onCancel={handleCancel}
      initialQuery={query}
      placeholder={placeholderText}
    />
  );
};
