/**
 * Hook 実行時のコンテキスト情報
 */
export interface HookContext {
  /** 新規 worktree の絶対パス */
  worktreePath: string;
  /** ブランチ名 */
  branchName: string;
  /** Git リポジトリのルートパス（main worktree） */
  repoRoot: string;
  /** リポジトリ名 */
  repoName: string;
}

/**
 * Hook 実行結果
 */
export interface HookResult {
  /** 成功したかどうか */
  success: boolean;
  /** 実行したコマンド数 */
  executedCount: number;
  /** 失敗したコマンド（あれば） */
  failedCommand?: string;
  /** 終了コード（失敗時） */
  exitCode?: number;
}
