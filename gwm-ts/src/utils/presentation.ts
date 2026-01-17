export type WorktreeStatus = 'MAIN' | 'OTHER' | string;

/**
 * ワークツリーの状態を表すアイコンを取得
 *
 * @param status  "MAIN" | "OTHER" など git worktree の状態
 * @param isActive 現在アクティブなワークツリーかどうか
 */
export const getStatusIcon = (
  status: WorktreeStatus,
  isActive: boolean
): string => {
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

/**
 * ワークツリーの状態を表す色名を取得 (ink の color)
 *
 * @param status   "MAIN" | "OTHER" など
 * @param isActive アクティブかどうか
 */
export const getStatusColor = (
  status: WorktreeStatus,
  isActive: boolean
): string => {
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
