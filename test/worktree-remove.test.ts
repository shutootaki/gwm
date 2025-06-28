import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, waitFor } from 'ink-testing-library';
import { WorktreeRemove } from '../src/components/WorktreeRemove.js';

// Git utils をモック化
vi.mock('../src/utils/git.js', () => ({
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
  }: any) => {
    return React.createElement('div', {
      'data-testid': 'multi-select-list',
      'data-items-count': items.length,
      'data-placeholder': placeholder,
      'data-initial-query': initialQuery,
      onClick: () =>
        onConfirm([{ label: 'test-branch test-path', value: '/test/path' }]),
      onKeyDown: (e: any) => e.key === 'Escape' && onCancel(),
    });
  },
}));

import { getWorktreesWithStatus, removeWorktree } from '../src/utils/git.js';

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

    const { getByTestId } = render(React.createElement(WorktreeRemove));

    await waitFor(() => {
      const multiSelect = getByTestId('multi-select-list');
      expect(multiSelect).toBeDefined();
      // メインworktreeを除外するので2つのアイテム
      expect(multiSelect.getAttribute('data-items-count')).toBe('2');
    });

    expect(mockGetWorktreesWithStatus).toHaveBeenCalledTimes(1);
  });

  it('should show no removable worktrees message when only main worktree exists', async () => {
    mockGetWorktreesWithStatus.mockResolvedValue([sampleWorktrees[0]]); // main only

    const { getByText } = render(React.createElement(WorktreeRemove));

    await waitFor(() => {
      expect(
        getByText(
          'No removable worktrees found (main worktree cannot be removed)'
        )
      ).toBeDefined();
    });
  });

  it('should remove selected worktrees successfully', async () => {
    mockGetWorktreesWithStatus.mockResolvedValue(sampleWorktrees);
    mockRemoveWorktree.mockReturnValue(undefined);

    const { getByTestId, getByText } = render(
      React.createElement(WorktreeRemove)
    );

    await waitFor(() => {
      const multiSelect = getByTestId('multi-select-list');
      multiSelect.click(); // triggers onConfirm
    });

    await waitFor(() => {
      expect(getByText('✓ Successfully removed 1 worktree(s):')).toBeDefined();
      expect(getByText('/test/path')).toBeDefined();
    });

    expect(mockRemoveWorktree).toHaveBeenCalledWith('/test/path', false);
  });

  it('should remove worktrees with force flag when specified', async () => {
    mockGetWorktreesWithStatus.mockResolvedValue(sampleWorktrees);
    mockRemoveWorktree.mockReturnValue(undefined);

    const { getByTestId } = render(
      React.createElement(WorktreeRemove, { force: true })
    );

    await waitFor(() => {
      const multiSelect = getByTestId('multi-select-list');
      expect(multiSelect.getAttribute('data-placeholder')).toContain(
        '(force mode)'
      );
      multiSelect.click();
    });

    await waitFor(() => {
      expect(mockRemoveWorktree).toHaveBeenCalledWith('/test/path', true);
    });
  });

  it('should handle worktree removal errors', async () => {
    mockGetWorktreesWithStatus.mockResolvedValue(sampleWorktrees);
    mockRemoveWorktree.mockImplementation(() => {
      throw new Error('Cannot remove worktree');
    });

    const { getByTestId, getByText } = render(
      React.createElement(WorktreeRemove)
    );

    await waitFor(() => {
      const multiSelect = getByTestId('multi-select-list');
      multiSelect.click();
    });

    await waitFor(() => {
      expect(
        getByText('✗ Error: /test/path: Cannot remove worktree')
      ).toBeDefined();
    });
  });

  it('should show error when no worktrees are selected', async () => {
    mockGetWorktreesWithStatus.mockResolvedValue(sampleWorktrees);

    const { getByTestId, getByText } = render(
      React.createElement(WorktreeRemove)
    );

    // MultiSelectListのモックを空の配列で呼ぶためのハック
    await waitFor(() => {
      const multiSelect = getByTestId('multi-select-list');
      // onConfirmを空配列で呼ぶ
      const mockOnConfirm = vi.fn();
      multiSelect.setAttribute('onClick', () => mockOnConfirm([]));
    });
  });

  it('should handle loading errors', async () => {
    mockGetWorktreesWithStatus.mockRejectedValue(new Error('Git error'));

    const { getByText } = render(React.createElement(WorktreeRemove));

    await waitFor(() => {
      expect(getByText('✗ Error: Git error')).toBeDefined();
    });
  });

  it('should pass query to MultiSelectList', async () => {
    mockGetWorktreesWithStatus.mockResolvedValue(sampleWorktrees);

    const { getByTestId } = render(
      React.createElement(WorktreeRemove, { query: 'feature' })
    );

    await waitFor(() => {
      const multiSelect = getByTestId('multi-select-list');
      expect(multiSelect.getAttribute('data-initial-query')).toBe('feature');
    });
  });
});
