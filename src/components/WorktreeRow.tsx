import React from 'react';
import { Box, Text } from 'ink';
import { Worktree, truncateAndPad, truncateStart } from '../utils/index.js';
import { getStatusIcon, getStatusColor } from '../utils/presentation.js';

interface WorktreeRowProps {
  worktree: Worktree;
  repoRoot: string;
  columnWidths: {
    branchWidth: number;
    pathWidth: number;
  };
}

/**
 * Worktree 1 行分の描画を司る小さなコンポーネント。
 * レンダリングのみに責任を持ち、ロジックは受け取った props で完結する。
 */
export const WorktreeRow: React.FC<WorktreeRowProps> = ({
  worktree,
  repoRoot,
  columnWidths,
}) => {
  // 相対パス
  const relPath = worktree.path.startsWith(repoRoot)
    ? worktree.path.substring(repoRoot.length + 1)
    : worktree.path;

  const statusIcon = getStatusIcon(worktree.status, worktree.isActive);
  const statusColor = getStatusColor(worktree.status, worktree.isActive);
  const statusText = worktree.isActive ? 'ACTIVE' : worktree.status;

  return (
    <Box marginBottom={0}>
      <Text>
        <Text>{statusIcon} </Text>
        <Text color={statusColor} bold>
          {statusText.padEnd(10)}
        </Text>
        <Text> </Text>
        <Text color={worktree.isActive ? 'yellow' : 'white'}>
          {truncateAndPad(worktree.branch, columnWidths.branchWidth)}
        </Text>
        <Text color="gray">
          {truncateStart(relPath, columnWidths.pathWidth)}
        </Text>
        <Text color="cyan">{worktree.head.substring(0, 7)}</Text>
      </Text>
    </Box>
  );
};
