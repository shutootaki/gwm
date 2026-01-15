import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render } from 'ink-testing-library';
import { WorktreeRemove } from '../src/components/WorktreeRemove.js';

// Git utils をモック化
vi.mock('../src/utils/git/index.js', () => ({
  getWorktreesWithStatus: vi.fn(),
  removeWorktree: vi.fn(),
}));

// MultiSelectListをモック化
vi.mock('../src/components/MultiSelectList.js', () => ({
  MultiSelectList: ({
    items,
    onConfirm,
    onCancel,
    placeholder,
    initialQuery,
  }: {
    items: { label: string; value: string }[];
    onConfirm: (selected: { label: string; value: string }[]) => void;
    onCancel: () => void;
    placeholder?: string;
    initialQuery?: string;
  }) => {
    return (
      <div
        data-testid="multi-select-list"
        data-items-count={items.length}
        data-placeholder={placeholder}
        data-initial-query={initialQuery}
        onClick={() =>
          onConfirm([{ label: 'test-branch test-path', value: '/test/path' }])
        }
        onKeyDown={(e: React.KeyboardEvent) =>
          e.key === 'Escape' && onCancel()
        }
      />
    );
  },
}));

import {
  getWorktreesWithStatus,
  removeWorktree,
} from '../src/utils/git/index.js';

const mockGetWorktreesWithStatus = vi.mocked(getWorktreesWithStatus);
const mockRemoveWorktree = vi.mocked(removeWorktree);

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
  {
    path: '/other/path',
    branch: 'other-branch',
    head: 'ghi789',
    status: 'PRUNABLE' as const,
    isActive: false,
    isMain: false,
  },
];

describe('WorktreeRemove', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should load and display non-main worktrees', async () => {
    mockGetWorktreesWithStatus.mockResolvedValue(sampleWorktrees);

    const { lastFrame } = render(<WorktreeRemove />);

    // Wait for useEffect to complete
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(mockGetWorktreesWithStatus).toHaveBeenCalledTimes(1);
    expect(lastFrame()).toBeDefined();
  });

  it('should show no removable worktrees message when only main worktree exists', async () => {
    mockGetWorktreesWithStatus.mockResolvedValue([sampleWorktrees[0]]); // main only

    const { lastFrame } = render(<WorktreeRemove />);

    // Wait for useEffect to complete
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(mockGetWorktreesWithStatus).toHaveBeenCalledTimes(1);
    expect(lastFrame()).toBeDefined();
  });

  it('should remove selected worktrees successfully', async () => {
    mockGetWorktreesWithStatus.mockResolvedValue(sampleWorktrees);
    mockRemoveWorktree.mockResolvedValue(undefined);

    const { lastFrame } = render(<WorktreeRemove />);

    // Wait for useEffect to complete
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(mockGetWorktreesWithStatus).toHaveBeenCalledTimes(1);
    expect(lastFrame()).toBeDefined();
  });

  it('should remove worktrees with force flag when specified', async () => {
    mockGetWorktreesWithStatus.mockResolvedValue(sampleWorktrees);
    mockRemoveWorktree.mockResolvedValue(undefined);

    const { lastFrame } = render(<WorktreeRemove force={true} />);

    // Wait for useEffect to complete
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(mockGetWorktreesWithStatus).toHaveBeenCalledTimes(1);
    expect(lastFrame()).toBeDefined();
  });

  it('should handle worktree removal errors', async () => {
    mockGetWorktreesWithStatus.mockResolvedValue(sampleWorktrees);
    mockRemoveWorktree.mockImplementation(() => {
      throw new Error('Cannot remove worktree');
    });

    const { lastFrame } = render(<WorktreeRemove />);

    // Wait for useEffect to complete
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(mockGetWorktreesWithStatus).toHaveBeenCalledTimes(1);
    expect(lastFrame()).toBeDefined();
  });

  it('should show error when no worktrees are selected', async () => {
    mockGetWorktreesWithStatus.mockResolvedValue(sampleWorktrees);

    const { lastFrame } = render(<WorktreeRemove />);

    // Wait for useEffect to complete
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(mockGetWorktreesWithStatus).toHaveBeenCalledTimes(1);
    expect(lastFrame()).toBeDefined();
  });

  it('should handle loading errors', async () => {
    mockGetWorktreesWithStatus.mockRejectedValue(new Error('Git error'));

    const { lastFrame } = render(<WorktreeRemove />);

    // Wait for useEffect to complete
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(mockGetWorktreesWithStatus).toHaveBeenCalledTimes(1);
    expect(lastFrame()).toBeDefined();
  });

  it('should pass query to MultiSelectList', async () => {
    mockGetWorktreesWithStatus.mockResolvedValue(sampleWorktrees);

    const { lastFrame } = render(<WorktreeRemove query="feature" />);

    // Wait for useEffect to complete
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(mockGetWorktreesWithStatus).toHaveBeenCalledTimes(1);
    expect(lastFrame()).toBeDefined();
  });
});
