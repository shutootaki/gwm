/**
 * 候補プロバイダ用キャッシュ機構
 * Kiro/Fig generator の高頻度実行に備えて1秒TTLでキャッシュ
 */

import type { CompletionCandidate } from './types.js';

interface CacheEntry {
  value: CompletionCandidate[];
  timestamp: number;
  repoRoot: string;
}

/** キャッシュストレージ（プロセスメモリ内） */
const cache = new Map<string, CacheEntry>();

/** キャッシュ有効期限（ミリ秒） */
const CACHE_TTL_MS = 1000; // 1秒

/**
 * キャッシュキーを生成
 */
function getCacheKey(providerId: string, repoRoot: string): string {
  return `${providerId}:${repoRoot}`;
}

/**
 * キャッシュから値を取得
 * @returns キャッシュヒット時は候補配列、ミス時はnull
 */
export function getCached(
  providerId: string,
  repoRoot: string
): CompletionCandidate[] | null {
  const key = getCacheKey(providerId, repoRoot);
  const entry = cache.get(key);

  if (!entry) {
    return null;
  }

  // TTL チェック
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }

  return entry.value;
}

/**
 * キャッシュに値を設定
 */
export function setCache(
  providerId: string,
  repoRoot: string,
  value: CompletionCandidate[]
): void {
  const key = getCacheKey(providerId, repoRoot);
  cache.set(key, {
    value,
    timestamp: Date.now(),
    repoRoot,
  });
}

/**
 * 全キャッシュをクリア（テスト用）
 */
export function clearCache(): void {
  cache.clear();
}
