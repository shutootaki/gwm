import React, { useEffect, useState } from 'react';
import { Text, Box } from 'ink';
import { getWorktreesWithStatus, Worktree } from '../utils/git.js';

export const WorktreeList: React.FC = () => {
  const [worktrees, setWorktrees] = useState<Worktree[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadWorktrees = async () => {
      try {
        const worktrees = await getWorktreesWithStatus();
        setWorktrees(worktrees);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      }
    };

    loadWorktrees();
  }, []);

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

  return (
    <Box flexDirection="column">
      <Box>
        <Text bold>
          {'STATUS'.padEnd(12)} {'BRANCH'.padEnd(25)} {'PATH'.padEnd(40)} {'HEAD'.padEnd(10)}
        </Text>
      </Box>
      <Box>
        <Text>
          {'-'.repeat(12)} {'-'.repeat(25)} {'-'.repeat(40)} {'-'.repeat(10)}
        </Text>
      </Box>
      {worktrees.map((worktree, index) => {
        const branchDisplay = worktree.status === 'PRUNABLE' 
          ? `${worktree.branch} (merged)` 
          : worktree.branch;
        
        return (
          <Box key={index}>
            <Text>
              {(worktree.isActive ? '* ' : '  ') + worktree.status.padEnd(10)} 
              {branchDisplay.padEnd(25)} 
              {worktree.path.padEnd(40)} 
              {worktree.head.substring(0, 7)}
            </Text>
          </Box>
        );
      })}
    </Box>
  );
};