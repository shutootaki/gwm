import React, { useEffect, useState } from 'react';
import { Text, Box } from 'ink';
import {
  getWorktreesWithStatus,
  Worktree,
  formatErrorForDisplay,
  getOptimalColumnWidths,
  truncateAndPad,
} from '../utils/index.js';

export const WorktreeList: React.FC = () => {
  const [worktrees, setWorktrees] = useState<Worktree[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadWorktrees = async () => {
      try {
        const worktrees = await getWorktreesWithStatus();
        setWorktrees(worktrees);
      } catch (err) {
        setError(formatErrorForDisplay(err));
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

  // 動的な列幅を計算
  const columnWidths = getOptimalColumnWidths(
    worktrees.map((w) => ({
      branch: w.status === 'PRUNABLE' ? `${w.branch} (merged)` : w.branch,
      path: w.path,
    }))
  );

  return (
    <Box flexDirection="column">
      <Box>
        <Text bold>
          {'STATUS'.padEnd(12)}{' '}
          {truncateAndPad('BRANCH', columnWidths.branchWidth)}{' '}
          {truncateAndPad('PATH', columnWidths.pathWidth)} {'HEAD'.padEnd(10)}
        </Text>
      </Box>
      <Box>
        <Text>
          {'-'.repeat(12)} {'-'.repeat(columnWidths.branchWidth)}{' '}
          {'-'.repeat(columnWidths.pathWidth)} {'-'.repeat(10)}
        </Text>
      </Box>
      {worktrees.map((worktree, index) => {
        const branchDisplay =
          worktree.status === 'PRUNABLE'
            ? `${worktree.branch} (merged)`
            : worktree.branch;

        return (
          <Box key={index}>
            <Text>
              {(worktree.isActive ? '* ' : '  ') + worktree.status.padEnd(10)}
              {truncateAndPad(branchDisplay, columnWidths.branchWidth)}
              {truncateAndPad(worktree.path, columnWidths.pathWidth)}
              {worktree.head.substring(0, 7)}
            </Text>
          </Box>
        );
      })}
    </Box>
  );
};
