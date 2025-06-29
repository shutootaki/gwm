import React from 'react';
import { Box, Text } from 'ink';
import { Worktree, truncateAndPad, truncateStart } from '../utils/index.js';
import { getStatusIcon, getStatusColor } from '../utils/presentation.js';
import { loadConfig } from '../config.js';

interface WorktreeRowProps {
  worktree: Worktree;
  repoRoot: string;
  columnWidths: {
    branchWidth: number;
    pathWidth: number;
  };
}

// 設定はモジュール読み込み時に一度だけ取得
const { worktree_base_path: WORKTREE_BASE_PATH } = loadConfig();

/**
 * Worktree 1 行分の描画を司る小さなコンポーネント。
 * レンダリングのみに責任を持ち、ロジックは受け取った props で完結する。
 */
export const WorktreeRow: React.FC<WorktreeRowProps> = ({
  worktree,
  repoRoot,
  columnWidths,
}) => {
  // 表示用パスの決定
  //   1) worktree.path がベースパス配下なら `${B}/` を prefix とし、
  //      ベースパス直下からの相対パスを表示
  //   2) repoRoot 配下なら repoRoot 相対パス
  //   3) それ以外は絶対パス

  const BASE_TOKEN = '${B}';

  let rawPath: string;
  let prefix = '';

  if (worktree.path.startsWith(WORKTREE_BASE_PATH)) {
    // `${B}/` を付与
    prefix = `${BASE_TOKEN}/`;
    rawPath = worktree.path.substring(WORKTREE_BASE_PATH.length + 1);
  } else if (worktree.path.startsWith(repoRoot)) {
    rawPath = worktree.path.substring(repoRoot.length + 1);
  } else {
    rawPath = worktree.path;
  }

  // prefix を保持したまま相対パス部分のみをトランケート
  let displayPath: string;
  if (columnWidths.pathWidth <= prefix.length) {
    // 列幅が極端に小さい場合は prefix のみを切り詰めて表示
    displayPath = prefix.substring(0, columnWidths.pathWidth);
  } else {
    const truncated = truncateStart(
      rawPath,
      columnWidths.pathWidth - prefix.length
    );
    displayPath = (prefix + truncated).padEnd(columnWidths.pathWidth);
  }

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
        <Text color="gray">{displayPath}</Text>
        <Text color="cyan">{worktree.head.substring(0, 7)}</Text>
      </Text>
    </Box>
  );
};
