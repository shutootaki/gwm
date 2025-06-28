import React from 'react';
import { WorktreeSelector } from './WorktreeSelector.js';

interface WorktreeGoProps {
  query?: string;
}

export const WorktreeGo: React.FC<WorktreeGoProps> = ({ query }) => {
  const handleSelect = (worktree: { path: string }) => {
    // Output path only and exit
    console.log(worktree.path);
    process.exit(0);
  };

  const handleCancel = () => {
    // Exit without output
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
