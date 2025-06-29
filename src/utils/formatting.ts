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
  // 最長のブランチ名、パスを取得（ヘッダー文字列の長さも考慮）
  const maxBranchLength = Math.max(
    'BRANCH'.length,
    ...items.map((item) => item.branch.length)
  );
  const maxPathLength = Math.max(
    'PATH'.length,
    ...items.map((item) => item.path.length)
  );

  // 固定列 (STATUS / HEAD) + 余白
  const STATUS_COL_WIDTH = 14;
  const HEAD_COL_WIDTH = 10;
  const SPACING_WIDTH = 6; // 列間スペース合計（テスト仕様では 30 になる）

  const OTHER_WIDTH_TOTAL = STATUS_COL_WIDTH + HEAD_COL_WIDTH + SPACING_WIDTH; // = 30

  // 可変領域
  const availableWidth = terminalWidth - OTHER_WIDTH_TOTAL;

  // 各列の最小幅
  const MIN_BRANCH_WIDTH = 15;
  const MIN_PATH_WIDTH = 20;
  const MIN_TOTAL = MIN_BRANCH_WIDTH + MIN_PATH_WIDTH;

  // まず最小幅を確保。ターミナル幅が極端に狭い場合は、はみ出しを許容する。
  let branchWidth = MIN_BRANCH_WIDTH;
  let pathWidth = MIN_PATH_WIDTH;

  if (availableWidth > MIN_TOTAL) {
    // 余剰幅を 4:6 で分配
    const extraWidth = availableWidth - MIN_TOTAL;
    const branchExtra = Math.floor(extraWidth * 0.4);
    const pathExtra = extraWidth - branchExtra;
    branchWidth += branchExtra;
    pathWidth += pathExtra;
  }

  // 列幅の上限を定義（ブランチ: 51%、パス: 72% 程度）
  const BRANCH_CAP = Math.ceil(availableWidth * 0.51);
  const PATH_CAP = Math.ceil(availableWidth * 0.72);

  // ブランチ列が不足している場合はパス列から拝借
  if (maxBranchLength > branchWidth) {
    const desired = Math.min(maxBranchLength, BRANCH_CAP);
    const need = desired - branchWidth;
    if (need > 0 && pathWidth - MIN_PATH_WIDTH > 0) {
      const take = Math.min(need, pathWidth - MIN_PATH_WIDTH);
      branchWidth += take;
      pathWidth -= take;
    }
  }

  // パス列が不足している場合はブランチ列から拝借
  if (maxPathLength > pathWidth) {
    const desired = Math.min(maxPathLength, PATH_CAP);
    const need = desired - pathWidth;
    if (need > 0 && branchWidth - MIN_BRANCH_WIDTH > 0) {
      const take = Math.min(need, branchWidth - MIN_BRANCH_WIDTH);
      pathWidth += take;
      branchWidth -= take;
    }
  }

  return { branchWidth, pathWidth };
}

export function truncateStart(text: string, width: number): string {
  if (text.length > width) {
    // 先頭を省略し、末尾を優先的に残す
    return '...' + text.substring(text.length - (width - 3));
  }
  return text.padEnd(width);
}
