import React, { useState, useEffect } from 'react';
import { Text, Box } from 'ink';
import { SelectList } from './SelectList.js';
import { SelectItem } from '../types/index.js';
import {
  getWorktreesWithStatus,
  Worktree,
  getStatusIcon,
} from '../utils/index.js';

interface WorktreeSelectorProps {
  onSelect: (worktree: Worktree) => void;
  onCancel: () => void;
  initialQuery?: string;
  placeholder?: string;
}

export const WorktreeSelector: React.FC<WorktreeSelectorProps> = ({
  onSelect,
  onCancel,
  initialQuery = '',
  placeholder = 'Select a worktree:',
}) => {
  const [worktrees, setWorktrees] = useState<Worktree[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadWorktrees = async () => {
      try {
        const parsed = await getWorktreesWithStatus();
        setWorktrees(parsed);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      }
    };

    loadWorktrees();
  }, []);

  const handleSelect = (item: SelectItem) => {
    const worktree = worktrees.find((w) => w.path === item.value);
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

  // mainワークツリーを先頭に、アクティブなワークツリーを次に表示
  const sortedWorktrees = [...worktrees].sort((a, b) => {
    if (a.isMain && !b.isMain) return -1;
    if (!a.isMain && b.isMain) return 1;
    if (a.isActive && !b.isActive) return -1;
    if (!a.isActive && b.isActive) return 1;
    return 0;
  });

  const items: SelectItem[] = sortedWorktrees.map((worktree) => {
    const icon = getStatusIcon(worktree.status, worktree.isActive);
    const prefix = icon !== ' ' ? `[${icon}] ` : '';
    return {
      label: `${prefix}${worktree.branch.padEnd(30)} ${worktree.path}`,
      value: worktree.path,
    };
  });

  return (
    <Box flexDirection="column">
      <SelectList
        items={items}
        onSelect={handleSelect}
        onCancel={onCancel}
        placeholder={placeholder}
        initialQuery={initialQuery}
      />
      <Box>
        <Text color="gray">
          <Text color="yellow">[*]</Text> Active {'  '}
          <Text color="cyan">[M]</Text> Main {'  '}
          <Text color="white">[-]</Text> Other
        </Text>
      </Box>
    </Box>
  );
};
