import React, { useState, useEffect } from 'react';
import { Text, Box } from 'ink';
import { execSync } from 'child_process';
import { SelectList, SelectItem } from './SelectList.js';

interface Worktree {
  path: string;
  branch: string;
  head: string;
}

interface WorktreeSelectorProps {
  onSelect: (worktree: Worktree) => void;
  onCancel: () => void;
  initialQuery?: string;
  placeholder?: string;
}

export const WorktreeSelector: React.FC<WorktreeSelectorProps> = ({
  onSelect,
  onCancel,
  initialQuery = "",
  placeholder = "Select a worktree:",
}) => {
  const [worktrees, setWorktrees] = useState<Worktree[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const output = execSync('git worktree list --porcelain', { 
        encoding: 'utf8',
        cwd: process.cwd()
      });
      
      const parsed = parseWorktrees(output);
      setWorktrees(parsed);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  }, []);

  const handleSelect = (item: SelectItem) => {
    const worktree = worktrees.find(w => w.path === item.value);
    if (worktree) {
      onSelect(worktree);
    }
  };

  if (error) {
    return (
      <Box>
        <Text color="red">Error: {error}</Text>
      </Box>
    );
  }

  if (worktrees.length === 0) {
    return (
      <Box>
        <Text>No worktrees found</Text>
      </Box>
    );
  }

  const items: SelectItem[] = worktrees.map(worktree => ({
    label: `${worktree.branch.padEnd(30)} ${worktree.path}`,
    value: worktree.path
  }));

  return (
    <SelectList
      items={items}
      onSelect={handleSelect}
      onCancel={onCancel}
      placeholder={placeholder}
      initialQuery={initialQuery}
    />
  );
};

function parseWorktrees(output: string): Worktree[] {
  const lines = output.trim().split('\n');
  const worktrees: Worktree[] = [];
  let currentWorktree: Partial<Worktree> = {};

  for (const line of lines) {
    if (line.startsWith('worktree ')) {
      if (currentWorktree.path) {
        worktrees.push(currentWorktree as Worktree);
      }
      currentWorktree = {
        path: line.substring(9)
      };
    } else if (line.startsWith('HEAD ')) {
      currentWorktree.head = line.substring(5);
    } else if (line.startsWith('branch ')) {
      currentWorktree.branch = line.substring(7);
    } else if (line === 'bare') {
      currentWorktree.branch = '(bare)';
    } else if (line === 'detached') {
      currentWorktree.branch = '(detached)';
    }
  }

  if (currentWorktree.path) {
    worktrees.push(currentWorktree as Worktree);
  }

  return worktrees;
}