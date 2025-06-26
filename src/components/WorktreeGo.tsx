import React from 'react';
import { WorktreeSelector } from './WorktreeSelector.js';

interface WorktreeGoProps {
  query?: string;
}

export const WorktreeGo: React.FC<WorktreeGoProps> = ({ query }) => {
  const handleSelect = (worktree: { path: string }) => {
    // パスのみを出力して終了
    console.log(worktree.path);
    process.exit(0);
  };

  const handleCancel = () => {
    // 何も出力せずに終了
    process.exit(0);
  };

  return (
    <WorktreeSelector
      onSelect={handleSelect}
      onCancel={handleCancel}
      initialQuery={query}
      placeholder="Select a worktree to go to:"
    />
  );
};