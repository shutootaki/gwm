import React, { useMemo } from 'react';
import { Box, Text } from 'ink';
import { Worktree, getOptimalColumnWidths } from '../utils/index.js';
import { getRepoRoot } from '../utils/git.js';
import { useTerminalWidth } from '../hooks/useTerminalWidth.js';
import { WorktreeRow } from './WorktreeRow.js';
import { loadConfig } from '../config.js';

interface WorktreeTableProps {
  /** 一覧に表示するワークツリー */
  worktrees: Worktree[];
  /** ヘッダーのタイトル (デフォルト: "Worktrees") */
  title?: string;
  /** テーブル下部に追加するカスタムフッター */
  footer?: React.ReactNode;
}

/**
 * ワークツリー一覧をテーブル形式で表示する共通コンポーネント
 */
export const WorktreeTable: React.FC<WorktreeTableProps> = ({
  worktrees,
  title = 'Worktrees',
  footer,
}) => {
  // 現在のターミナル幅を取得 (必ず最初に呼び出す)
  const terminalWidth = useTerminalWidth();

  // Git リポジトリのルート (不変)
  const repoRoot = useMemo(() => getRepoRoot(), []);

  // 設定ファイル (不変)
  const { worktree_base_path: WORKTREE_BASE_PATH } = loadConfig();

  const BASE_TOKEN = '${B}';

  // 統計情報をメモ化
  const stats = useMemo(() => {
    return {
      total: worktrees.length,
      active: worktrees.filter((w) => w.isActive).length,
      main: worktrees.filter((w) => w.status === 'MAIN' && !w.isActive).length,
      other: worktrees.filter((w) => w.status === 'OTHER').length,
    } as const;
  }, [worktrees]);

  // 列幅計算（ターミナル幅依存）
  const columnWidths = useMemo(() => {
    const displayItems = worktrees.map((w) => {
      let pathStr: string;
      if (w.path.startsWith(WORKTREE_BASE_PATH)) {
        pathStr = `${BASE_TOKEN}/${w.path.substring(
          WORKTREE_BASE_PATH.length + 1
        )}`;
      } else if (w.path.startsWith(repoRoot)) {
        pathStr = w.path.substring(repoRoot.length + 1);
      } else {
        pathStr = w.path;
      }

      return { branch: w.branch, path: pathStr };
    });
    return getOptimalColumnWidths(displayItems, terminalWidth);
  }, [worktrees, repoRoot, terminalWidth, WORKTREE_BASE_PATH]);

  const isEmpty = worktrees.length === 0;

  return (
    <Box flexDirection="column">
      {isEmpty ? (
        <Text color="yellow">No worktrees found</Text>
      ) : (
        <>
          {/* Header */}
          <Box marginBottom={1}>
            <Box flexDirection="column">
              <Text color="cyan" bold>
                {title}
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

              {/* Legend for base path */}
              {WORKTREE_BASE_PATH && (
                <Text color="gray">
                  {'${B}'} = {WORKTREE_BASE_PATH}
                </Text>
              )}
            </Box>
          </Box>

          {/* Table header */}
          <Box>
            <Text color="cyan" bold>
              {'   STATUS'.padEnd(14)}{' '}
              {`BRANCH`.padEnd(columnWidths.branchWidth)}{' '}
              {`DIR_PATH`.padEnd(columnWidths.pathWidth)} {'HEAD'.padEnd(10)}
            </Text>
          </Box>

          <Box>
            <Text color="gray">
              {'   ══════'.padEnd(14)} {'═'.repeat(columnWidths.branchWidth)}{' '}
              {'═'.repeat(columnWidths.pathWidth)} {'══════════'.padEnd(10)}
            </Text>
          </Box>

          {/* Body */}
          <Box flexDirection="column">
            {worktrees.map((wt, idx) => (
              <WorktreeRow
                key={idx}
                worktree={wt}
                repoRoot={repoRoot}
                columnWidths={columnWidths}
              />
            ))}
          </Box>
        </>
      )}

      {/* Footer */}
      {footer && (
        <Box marginTop={1} flexDirection="column">
          {footer}
        </Box>
      )}
    </Box>
  );
};
