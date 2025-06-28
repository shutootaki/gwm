// フォーマットユーティリティ

export function truncateAndPad(text: string, width: number): string {
  if (text.length > width) {
    return text.substring(0, width - 3) + '...';
  }
  return text.padEnd(width);
}

export function getOptimalColumnWidths(
  items: Array<{ branch: string; path: string }>,
  terminalWidth: number = 120
): { branchWidth: number; pathWidth: number } {
  const maxBranchLength = Math.max(
    ...items.map((item) => item.branch.length),
    'BRANCH'.length
  );
  const maxPathLength = Math.max(
    ...items.map((item) => item.path.length),
    'PATH'.length
  );

  // 最小幅を設定
  const minBranchWidth = Math.max(15, Math.min(maxBranchLength, 30));
  const minPathWidth = Math.max(20, Math.min(maxPathLength, 50));

  // 残りの幅を配分
  const remainingWidth = terminalWidth - 30; // STATUS, HEAD, spacingのための余白
  const totalMinWidth = minBranchWidth + minPathWidth;

  if (totalMinWidth <= remainingWidth) {
    const extraWidth = remainingWidth - totalMinWidth;
    return {
      branchWidth: minBranchWidth + Math.floor(extraWidth * 0.4),
      pathWidth: minPathWidth + Math.floor(extraWidth * 0.6),
    };
  }

  return {
    branchWidth: minBranchWidth,
    pathWidth: minPathWidth,
  };
}
