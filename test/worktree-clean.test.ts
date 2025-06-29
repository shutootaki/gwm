import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render } from 'ink-testing-library';
import { WorktreeClean } from '../src/components/WorktreeClean.js';
import {
  fetchAndPrune,
  getCleanableWorktrees,
  removeWorktree,
} from '../src/utils/index.js';
import type { CleanableWorktree } from '../src/utils/index.js';

// --------------------
// Mock external modules
// --------------------

vi.mock('../src/utils/index.js', () => ({
  fetchAndPrune: vi.fn(),
  getCleanableWorktrees: vi.fn(),
  removeWorktree: vi.fn(),
}));

// Spinner をダミーに（余計なANSIシーケンスを避ける）
vi.mock('ink-spinner', () => ({
  default: () => React.createElement('span', { 'data-testid': 'spinner' }),
}));

const mockFetchAndPrune = vi.mocked(fetchAndPrune);
const mockGetCleanableWorktrees = vi.mocked(getCleanableWorktrees);
const mockRemoveWorktree = vi.mocked(removeWorktree);

// サンプル cleanable worktrees
const sampleCleanables: CleanableWorktree[] = [
  {
    worktree: {
      path: '/tmp/wt/feature-a',
      branch: 'feature-a',
      head: '111',
      status: 'NORMAL',
      isActive: false,
      isMain: false,
    },
    reason: 'merged',
    mergedIntoBranch: 'main',
  },
  {
    worktree: {
      path: '/tmp/wt/feature-b',
      branch: 'feature-b',
      head: '222',
      status: 'NORMAL',
      isActive: false,
      isMain: false,
    },
    reason: 'remote_deleted',
  },
];

describe('WorktreeClean', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch/prune and load cleanable worktrees', async () => {
    mockGetCleanableWorktrees.mockResolvedValue([]);

    render(React.createElement(WorktreeClean));

    // fetchAndPrune は1回呼ばれる
    expect(mockFetchAndPrune).toHaveBeenCalledTimes(1);
    // getCleanableWorktrees は1回呼ばれる
    expect(mockGetCleanableWorktrees).toHaveBeenCalledTimes(1);
  });

  it('should show message when no cleanable worktrees found', async () => {
    mockGetCleanableWorktrees.mockResolvedValue([]);

    const { lastFrame } = render(React.createElement(WorktreeClean));

    await vi.waitFor(() => {
      expect(lastFrame()).toContain('No cleanable worktrees found.');
    });
  });

  it('force mode should remove all listed worktrees on Enter', async () => {
    mockGetCleanableWorktrees.mockResolvedValue(sampleCleanables);
    mockRemoveWorktree.mockReturnValue(undefined);

    const { lastFrame } = render(
      React.createElement(WorktreeClean, { force: true })
    );

    await vi.waitFor(() => {
      // removeWorktree が2件呼ばれる
      expect(mockRemoveWorktree).toHaveBeenCalledTimes(2);
      // 成功メッセージを確認
      expect(lastFrame()).toMatch(/Successfully cleaned 2 worktree\(s\)/);
    });
  });

  it('confirm mode should cancel on Esc without removing', async () => {
    mockGetCleanableWorktrees.mockResolvedValue(sampleCleanables);

    const { stdin, lastFrame } = render(React.createElement(WorktreeClean));

    // "Press Enter" の表示を待って Esc
    await vi.waitFor(() => {
      expect(lastFrame()).toMatch(/Press Enter to delete/);
    });

    stdin.write('\x1B');

    await vi.waitFor(() => {
      expect(mockRemoveWorktree).not.toHaveBeenCalled();
      expect(lastFrame()).toContain('Cancelled');
    });
  });
});
