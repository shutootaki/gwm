/**
 * 候補プロバイダの型定義
 */

/**
 * 補完候補
 */
export interface CompletionCandidate {
  /** 候補の値 */
  value: string;
  /** 説明文（オプション） */
  description?: string;
}
