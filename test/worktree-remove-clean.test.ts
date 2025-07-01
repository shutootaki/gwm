/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render } from 'ink-testing-library';
import { WorktreeRemove } from '../src/components/WorktreeRemove.js';

// --------------------
// Mock external modules
// --------------------

vi.mock('../src/utils/index.js', () => ({
  getWorktreesWithStatus: vi.fn(),
  removeWorktree: vi.fn(),
  localBranchExists: vi.fn(),
  hasUnmergedCommits: vi.fn(),
  deleteLocalBranch: vi.fn(),
}));

// MultiSelectList をモック化して自動的に onConfirm を呼び出す
vi.mock('../src/components/MultiSelectList.js', () => ({
  MultiSelectList: ({ items, onConfirm }: any) => {
    // 最初のアイテムを自動選択して confirm
    setImmediate(() => {
      onConfirm([{ label: items[0].label, value: items[0].value }]);
    });
    return React.createElement('div', { 'data-testid': 'multi-select-list' });
  },
}));

import {
  getWorktreesWithStatus,
  removeWorktree,
  localBranchExists,
  hasUnmergedCommits,
  deleteLocalBranch,
} from '../src/utils/index.js';

const mockGetWorktreesWithStatus = vi.mocked(getWorktreesWithStatus);
const mockRemoveWorktree = vi.mocked(removeWorktree);
const mockLocalBranchExists = vi.mocked(localBranchExists);
const mockHasUnmergedCommits = vi.mocked(hasUnmergedCommits);
const mockDeleteLocalBranch = vi.mocked(deleteLocalBranch);

// サンプル worktree データ
const sampleWorktrees = [
  {
    path: '/main/path',
    branch: 'main',
    head: 'abc123',
    status: 'NORMAL' as const,
    isActive: true,
    isMain: true,
  },
  {
    path: '/feature/path',
    branch: 'feature/test',
    head: 'def456',
    status: 'NORMAL' as const,
    isActive: false,
    isMain: false,
  },
];

describe('WorktreeRemove – branch clean flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should delete local branch when cleanBranch="auto"', async () => {
    // 1st call: initial list (includes feature)
    // 2nd call: after removal (only main remains)
    mockGetWorktreesWithStatus
      .mockResolvedValueOnce(sampleWorktrees)
      .mockResolvedValueOnce([sampleWorktrees[0]]);

    mockRemoveWorktree.mockReturnValue(undefined);
    mockLocalBranchExists.mockReturnValue(true);
    mockHasUnmergedCommits.mockReturnValue(false);

    const { unmount } = render(
      React.createElement(WorktreeRemove, { cleanBranch: 'auto' })
    );

    await vi.waitFor(() => {
      expect(mockRemoveWorktree).toHaveBeenCalledWith('/feature/path', false);
      expect(mockDeleteLocalBranch).toHaveBeenCalledWith('feature/test', false);
    });

    unmount();
  });

  it('should not delete local branch when cleanBranch="never"', async () => {
    mockGetWorktreesWithStatus
      .mockResolvedValueOnce(sampleWorktrees)
      .mockResolvedValueOnce([sampleWorktrees[0]]);

    mockRemoveWorktree.mockReturnValue(undefined);
    mockLocalBranchExists.mockReturnValue(true);
    mockHasUnmergedCommits.mockReturnValue(false);

    const { unmount } = render(
      React.createElement(WorktreeRemove, { cleanBranch: 'never' })
    );

    await vi.waitFor(() => {
      expect(mockRemoveWorktree).toHaveBeenCalledWith('/feature/path', false);
    });

    expect(mockDeleteLocalBranch).not.toHaveBeenCalled();

    unmount();
  });
});
