/**
 * キャッシュ機構のテスト
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  getCached,
  setCache,
  clearCache,
} from '../../../src/completion/providers/cache.js';

describe('cache', () => {
  beforeEach(() => {
    clearCache();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('キャッシュに値を設定して取得できる', () => {
    const candidates = [{ value: 'test', description: 'desc' }];
    setCache('worktrees', '/repo', candidates);
    const result = getCached('worktrees', '/repo');
    expect(result).toEqual(candidates);
  });

  it('異なるプロバイダIDは別のキャッシュ', () => {
    const candidates1 = [{ value: 'worktree1' }];
    const candidates2 = [{ value: 'branch1' }];

    setCache('worktrees', '/repo', candidates1);
    setCache('localBranches', '/repo', candidates2);

    expect(getCached('worktrees', '/repo')).toEqual(candidates1);
    expect(getCached('localBranches', '/repo')).toEqual(candidates2);
  });

  it('異なるリポジトリは別のキャッシュ', () => {
    const candidates1 = [{ value: 'repo1' }];
    const candidates2 = [{ value: 'repo2' }];

    setCache('worktrees', '/repo1', candidates1);
    setCache('worktrees', '/repo2', candidates2);

    expect(getCached('worktrees', '/repo1')).toEqual(candidates1);
    expect(getCached('worktrees', '/repo2')).toEqual(candidates2);
  });

  it('TTL（1秒）後にキャッシュが無効になる', () => {
    const candidates = [{ value: 'test' }];
    setCache('worktrees', '/repo', candidates);

    // 500ms後はまだ有効
    vi.advanceTimersByTime(500);
    expect(getCached('worktrees', '/repo')).toEqual(candidates);

    // 1001ms後は無効
    vi.advanceTimersByTime(501);
    expect(getCached('worktrees', '/repo')).toBeNull();
  });

  it('存在しないキーは null を返す', () => {
    expect(getCached('worktrees', '/nonexistent')).toBeNull();
  });

  it('clearCache で全キャッシュがクリアされる', () => {
    setCache('worktrees', '/repo', [{ value: 'test' }]);
    setCache('localBranches', '/repo', [{ value: 'branch' }]);

    clearCache();

    expect(getCached('worktrees', '/repo')).toBeNull();
    expect(getCached('localBranches', '/repo')).toBeNull();
  });
});
