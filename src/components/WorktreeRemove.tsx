import React, { useState, useEffect } from 'react';
import { Text, Box } from 'ink';
import { MultiSelectList, SelectItem } from './MultiSelectList.js';
import { getWorktreesWithStatus, removeWorktree, Worktree } from '../utils/git.js';

interface WorktreeRemoveProps {
  query?: string;
  force?: boolean;
}

export const WorktreeRemove: React.FC<WorktreeRemoveProps> = ({
  query = "",
  force = false,
}) => {
  const [worktrees, setWorktrees] = useState<Worktree[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string[]>([]);
  const [removing, setRemoving] = useState(false);

  useEffect(() => {
    const loadWorktrees = async () => {
      try {
        const allWorktrees = await getWorktreesWithStatus();
        // メインworktreeを除外
        const nonMainWorktrees = allWorktrees.filter(w => !w.isMain);
        setWorktrees(nonMainWorktrees);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      }
    };

    loadWorktrees();
  }, []);

  const handleConfirm = async (selectedItems: SelectItem[]) => {
    if (selectedItems.length === 0) {
      setError('No worktrees selected');
      return;
    }

    setRemoving(true);
    const removedPaths: string[] = [];
    const errors: string[] = [];

    for (const item of selectedItems) {
      try {
        removeWorktree(item.value, force);
        removedPaths.push(item.value);
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Unknown error';
        errors.push(`${item.value}: ${errorMsg}`);
      }
    }

    if (errors.length > 0) {
      setError(errors.join('\n'));
    }
    
    if (removedPaths.length > 0) {
      setSuccess(removedPaths);
    }

    setRemoving(false);
  };

  const handleCancel = () => {
    setError('Cancelled');
  };

  if (success.length > 0) {
    return (
      <Box flexDirection="column">
        <Text color="green">✓ Successfully removed {success.length} worktree(s):</Text>
        {success.map(path => (
          <Text key={path}>  {path}</Text>
        ))}
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

  if (removing) {
    return (
      <Box>
        <Text>Removing worktrees...</Text>
      </Box>
    );
  }

  if (worktrees.length === 0) {
    return (
      <Box>
        <Text>No removable worktrees found (main worktree cannot be removed)</Text>
      </Box>
    );
  }

  const items: SelectItem[] = worktrees.map(worktree => ({
    label: `${worktree.branch.padEnd(30)} ${worktree.path}`,
    value: worktree.path
  }));

  return (
    <MultiSelectList
      items={items}
      onConfirm={handleConfirm}
      onCancel={handleCancel}
      placeholder={`Select worktrees to remove${force ? ' (force mode)' : ''}:`}
      initialQuery={query}
    />
  );
};