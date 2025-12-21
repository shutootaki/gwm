/**
 * Provider 共通ベース関数
 * Git リポジトリ依存のプロバイダを簡潔に定義するためのファクトリー
 */

import { isGitRepository, getRepoRoot } from '../../utils/git/index.js';
import { getCached, setCache } from './cache.js';
import type { CompletionCandidate } from './types.js';

/**
 * プロバイダ設定
 */
export interface ProviderConfig<T> {
  /** プロバイダID（キャッシュキーに使用） */
  id: string;
  /** データ取得関数 */
  fetch: () => Promise<T[]>;
  /** データを候補に変換する関数 */
  transform: (item: T) => CompletionCandidate;
}

/**
 * Git リポジトリ依存のプロバイダを作成
 *
 * 共通処理:
 * - Git リポジトリ外では空配列を返す
 * - キャッシュを活用（1秒TTL）
 * - エラー時は空配列を返す（補完が壊れないように）
 */
export function createGitProvider<T>(
  config: ProviderConfig<T>
): () => Promise<CompletionCandidate[]> {
  return async (): Promise<CompletionCandidate[]> => {
    // Git リポジトリ外では空配列
    if (!isGitRepository()) {
      return [];
    }

    const repoRoot = getRepoRoot();

    // キャッシュチェック
    const cached = getCached(config.id, repoRoot);
    if (cached) {
      return cached;
    }

    try {
      const items = await config.fetch();
      const candidates = items.map(config.transform);
      setCache(config.id, repoRoot, candidates);
      return candidates;
    } catch {
      // エラー時は空配列を返して補完が壊れないようにする
      return [];
    }
  };
}
