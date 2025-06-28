import React, { useState } from 'react';
import { Text, Box } from 'ink';
import { execSync } from 'child_process';
import { WorktreeSelector } from './WorktreeSelector.js';
import { formatErrorForDisplay } from '../utils/index.js';

interface WorktreeCodeProps {
  query?: string;
}

export const WorktreeCode: React.FC<WorktreeCodeProps> = ({ query }) => {
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSelect = (worktree: { path: string; branch: string }) => {
    try {
      // codeコマンドが存在するかチェック
      execSync('which code', { stdio: 'ignore' });

      // VS Codeでディレクトリを開く（適切にエスケープ）
      const escapedPath = `"${worktree.path.replace(/"/g, '\\"')}"`;
      execSync(`code ${escapedPath}`, { stdio: 'inherit' });

      setSuccess(`Opened ${worktree.branch} in VS Code`);
      setTimeout(() => process.exit(0), 1000);
    } catch (err) {
      if (err instanceof Error && err.message.includes('which code')) {
        setError(
          'VS Code command "code" not found. Please install VS Code and add it to your PATH.'
        );
      } else {
        setError(formatErrorForDisplay(err));
      }
    }
  };

  const handleCancel = () => {
    process.exit(0);
  };

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
      placeholder="Select a worktree to open in VS Code:"
    />
  );
};
