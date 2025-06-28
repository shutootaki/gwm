import React, { useEffect, useState } from 'react';
import { Text, Box } from 'ink';
import {
  getWorktreesWithStatus,
  Worktree,
  formatErrorForDisplay,
  getOptimalColumnWidths,
  truncateAndPad,
} from '../utils/index.js';

const getStatusIcon = (status: string, isActive: boolean) => {
  if (isActive) return '*';
  switch (status) {
    case 'MAIN':
      return 'M';
    case 'OTHER':
      return '-';
    default:
      return ' ';
  }
};

const getStatusColor = (status: string, isActive: boolean) => {
  if (isActive) return 'yellow';
  switch (status) {
    case 'MAIN':
      return 'cyan';
    case 'OTHER':
      return 'white';
    default:
      return 'white';
  }
};

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

  // 統計情報の計算
  const stats = {
    total: worktrees.length,
    active: worktrees.filter((w) => w.isActive).length,
    main: worktrees.filter((w) => w.status === 'MAIN' && !w.isActive).length,
    other: worktrees.filter((w) => w.status === 'OTHER').length,
  };

  // 動的な列幅を計算
  const columnWidths = getOptimalColumnWidths(
    worktrees.map((w) => ({
      branch: w.branch,
      path: w.path,
    }))
  );

  return (
    <Box flexDirection="column">
      {/* Header */}
      <Box marginBottom={1}>
        <Box flexDirection="column">
          <Text color="cyan" bold>
            Worktrees
          </Text>
          <Text color="gray">
            Total:{' '}
            <Text color="white" bold>
              {stats.total}
            </Text>{' '}
            | Active:{' '}
            <Text color="yellow" bold>
              {stats.active}
            </Text>{' '}
            | Main:{' '}
            <Text color="cyan" bold>
              {stats.main}
            </Text>{' '}
            | Other:{' '}
            <Text color="white" bold>
              {stats.other}
            </Text>
          </Text>
        </Box>
      </Box>

      {/* テーブルヘッダー */}
      <Box marginBottom={1}>
        <Text color="cyan" bold>
          {'   STATUS'.padEnd(14)}{' '}
          {truncateAndPad('BRANCH', columnWidths.branchWidth)}{' '}
          {truncateAndPad('PATH', columnWidths.pathWidth)} {'HEAD'.padEnd(10)}
        </Text>
      </Box>

      <Box marginBottom={1}>
        <Text color="gray">
          {'   ══════'.padEnd(14)} {'═'.repeat(columnWidths.branchWidth)}{' '}
          {'═'.repeat(columnWidths.pathWidth)} {'══════════'.padEnd(10)}
        </Text>
      </Box>

      {/* ワークツリー一覧 */}
      <Box flexDirection="column">
        {worktrees.map((worktree, index) => {
          const branchDisplay = worktree.branch;

          const statusIcon = getStatusIcon(worktree.status, worktree.isActive);
          const statusColor = getStatusColor(
            worktree.status,
            worktree.isActive
          );
          const statusText = worktree.isActive ? 'ACTIVE' : worktree.status;

          return (
            <Box key={index} marginBottom={0}>
              <Text>
                <Text>{statusIcon} </Text>
                <Text color={statusColor} bold>
                  {statusText.padEnd(10)}
                </Text>
                <Text> </Text>
                <Text color={worktree.isActive ? 'yellow' : 'white'}>
                  {truncateAndPad(branchDisplay, columnWidths.branchWidth)}
                </Text>
                <Text color="gray">
                  {truncateAndPad(worktree.path, columnWidths.pathWidth)}
                </Text>
                <Text color="cyan">{worktree.head.substring(0, 7)}</Text>
              </Text>
            </Box>
          );
        })}
      </Box>

      {/* Footer */}
      <Box marginTop={1}>
        <Box flexDirection="column">
          <Text color="gray">
            Use <Text color="cyan">gwm go [query]</Text> to navigate,{' '}
            <Text color="cyan">gwm remove</Text> to delete
          </Text>
        </Box>
      </Box>
    </Box>
  );
};
