import React, { useEffect, useState } from 'react';
import { Text, Box } from 'ink';
import {
  getWorktreesWithStatus,
  Worktree,
  formatErrorForDisplay,
} from '../utils/index.js';
import { WorktreeTable } from './WorktreeTable.js';

export const WorktreeList: React.FC = () => {
  const [worktrees, setWorktrees] = useState<Worktree[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadWorktrees = async () => {
      try {
        setLoading(true);
        const worktrees = await getWorktreesWithStatus();
        setWorktrees(worktrees);
      } catch (err) {
        setError(formatErrorForDisplay(err));
      } finally {
        setLoading(false);
      }
    };

    loadWorktrees();
  }, []);

  if (loading) {
    return (
      <Box>
        <Text color="cyan">Loading worktrees...</Text>
      </Box>
    );
  }

  if (error) {
    return (
      <Box flexDirection="column">
        <Text color="red">Error: {error}</Text>
      </Box>
    );
  }

  if (worktrees.length === 0) {
    return (
      <Box flexDirection="column">
        <Text color="yellow">No worktrees found</Text>
        <Text color="gray">
          Use <Text color="cyan">gwm add</Text> to create one
        </Text>
      </Box>
    );
  }

  return (
    <WorktreeTable
      worktrees={worktrees}
      footer={
        <Text color="gray">
          Use <Text color="cyan">gwm go [query]</Text> to navigate,{' '}
          <Text color="cyan">gwm remove</Text> to delete
        </Text>
      }
    />
  );
};
