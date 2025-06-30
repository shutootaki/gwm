import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render } from 'ink-testing-library';
import { WorktreeSelector } from '../src/components/WorktreeSelector.js';
import type { Worktree } from '../src/utils/git.js';

// getWorktreesWithStatusをモック化
vi.mock('../src/utils/git.js', () => ({
  getWorktreesWithStatus: vi.fn(),
}));

// getStatusIconをモック化
vi.mock('../src/utils/presentation.js', () => ({
  getStatusIcon: vi.fn((status: string, isActive: boolean) => {
    if (isActive) return '*';
    if (status === 'MAIN') return 'M';
    return '-';
  }),
}));

// SelectListをモック化してitemsの順序を検証可能にする
let capturedItems: any[] = [];
vi.mock('../src/components/SelectList.js', () => ({
  SelectList: ({ items, onSelect, onCancel }: any) => {
    capturedItems = items;
    return React.createElement('div', {
      'data-testid': 'select-list',
      'data-items': JSON.stringify(items),
    });
  },
}));

import { getWorktreesWithStatus } from '../src/utils/git.js';
const mockGetWorktreesWithStatus = vi.mocked(getWorktreesWithStatus);

describe('WorktreeSelector', () => {
  const mockOnSelect = vi.fn();
  const mockOnCancel = vi.fn();

  const createMockWorktree = (overrides: Partial<Worktree>): Worktree => ({
    path: '/test/path',
    branch: 'test-branch',
    head: 'abc123',
    status: 'OTHER',
    isActive: false,
    isMain: false,
    ...overrides,
  });

  beforeEach(() => {
    vi.clearAllMocks();
    capturedItems = [];
  });

  describe('ソート機能', () => {
    it('mainワークツリーが最初に表示される', async () => {
      const worktrees: Worktree[] = [
        createMockWorktree({ branch: 'feature-a', path: '/path/feature-a' }),
        createMockWorktree({ branch: 'main', path: '/path/main', isMain: true, status: 'MAIN' }),
        createMockWorktree({ branch: 'feature-b', path: '/path/feature-b' }),
      ];
      mockGetWorktreesWithStatus.mockResolvedValue(worktrees);

      render(
        React.createElement(WorktreeSelector, {
          onSelect: mockOnSelect,
          onCancel: mockOnCancel,
        })
      );

      // 非同期処理を待つ
      await vi.waitFor(() => {
        expect(capturedItems.length).toBeGreaterThan(0);
      });

      expect(capturedItems[0].value).toBe('/path/main');
      expect(capturedItems[0].label).toContain('[M]');
    });

    it('activeワークツリーがmainの次に表示される', async () => {
      const worktrees: Worktree[] = [
        createMockWorktree({ branch: 'feature-a', path: '/path/feature-a' }),
        createMockWorktree({ branch: 'active-branch', path: '/path/active', isActive: true, status: 'ACTIVE' }),
        createMockWorktree({ branch: 'main', path: '/path/main', isMain: true, status: 'MAIN' }),
        createMockWorktree({ branch: 'feature-b', path: '/path/feature-b' }),
      ];
      mockGetWorktreesWithStatus.mockResolvedValue(worktrees);

      render(
        React.createElement(WorktreeSelector, {
          onSelect: mockOnSelect,
          onCancel: mockOnCancel,
        })
      );

      await vi.waitFor(() => {
        expect(capturedItems.length).toBeGreaterThan(0);
      });

      expect(capturedItems[0].value).toBe('/path/main');
      expect(capturedItems[1].value).toBe('/path/active');
      expect(capturedItems[1].label).toContain('[*]');
    });

    it('その他のワークツリーが最後に表示される', async () => {
      const worktrees: Worktree[] = [
        createMockWorktree({ branch: 'feature-c', path: '/path/feature-c' }),
        createMockWorktree({ branch: 'main', path: '/path/main', isMain: true, status: 'MAIN' }),
        createMockWorktree({ branch: 'active-branch', path: '/path/active', isActive: true, status: 'ACTIVE' }),
        createMockWorktree({ branch: 'feature-a', path: '/path/feature-a' }),
        createMockWorktree({ branch: 'feature-b', path: '/path/feature-b' }),
      ];
      mockGetWorktreesWithStatus.mockResolvedValue(worktrees);

      render(
        React.createElement(WorktreeSelector, {
          onSelect: mockOnSelect,
          onCancel: mockOnCancel,
        })
      );

      await vi.waitFor(() => {
        expect(capturedItems.length).toBeGreaterThan(0);
      });

      // 順序確認: main -> active -> その他
      expect(capturedItems[0].value).toBe('/path/main');
      expect(capturedItems[1].value).toBe('/path/active');
      expect(capturedItems[2].label).toContain('[-]');
      expect(capturedItems[3].label).toContain('[-]');
      expect(capturedItems[4].label).toContain('[-]');
    });
  });

  describe('アイコン表示', () => {
    it('mainワークツリーに[M]アイコンが表示される', async () => {
      const worktrees: Worktree[] = [
        createMockWorktree({ branch: 'main', path: '/path/main', isMain: true, status: 'MAIN' }),
      ];
      mockGetWorktreesWithStatus.mockResolvedValue(worktrees);

      render(
        React.createElement(WorktreeSelector, {
          onSelect: mockOnSelect,
          onCancel: mockOnCancel,
        })
      );

      await vi.waitFor(() => {
        expect(capturedItems.length).toBeGreaterThan(0);
      });

      expect(capturedItems[0].label).toMatch(/^\[M\] main/);
    });

    it('activeワークツリーに[*]アイコンが表示される', async () => {
      const worktrees: Worktree[] = [
        createMockWorktree({ branch: 'active-branch', path: '/path/active', isActive: true, status: 'ACTIVE' }),
      ];
      mockGetWorktreesWithStatus.mockResolvedValue(worktrees);

      render(
        React.createElement(WorktreeSelector, {
          onSelect: mockOnSelect,
          onCancel: mockOnCancel,
        })
      );

      await vi.waitFor(() => {
        expect(capturedItems.length).toBeGreaterThan(0);
      });

      expect(capturedItems[0].label).toMatch(/^\[\*\] active-branch/);
    });

    it('その他のワークツリーに[-]アイコンが表示される', async () => {
      const worktrees: Worktree[] = [
        createMockWorktree({ branch: 'feature-branch', path: '/path/feature' }),
      ];
      mockGetWorktreesWithStatus.mockResolvedValue(worktrees);

      render(
        React.createElement(WorktreeSelector, {
          onSelect: mockOnSelect,
          onCancel: mockOnCancel,
        })
      );

      await vi.waitFor(() => {
        expect(capturedItems.length).toBeGreaterThan(0);
      });

      expect(capturedItems[0].label).toMatch(/^\[-\] feature-branch/);
    });

    it('スペースアイコンの場合はプレフィックスが付かない', async () => {
      // getStatusIconが' 'を返すケースをモック
      vi.mocked(getStatusIcon).mockReturnValueOnce(' ');
      
      const worktrees: Worktree[] = [
        createMockWorktree({ branch: 'special-branch', path: '/path/special' }),
      ];
      mockGetWorktreesWithStatus.mockResolvedValue(worktrees);

      render(
        React.createElement(WorktreeSelector, {
          onSelect: mockOnSelect,
          onCancel: mockOnCancel,
        })
      );

      await vi.waitFor(() => {
        expect(capturedItems.length).toBeGreaterThan(0);
      });

      expect(capturedItems[0].label).toMatch(/^special-branch/);
      expect(capturedItems[0].label).not.toMatch(/^\[/);
    });
  });

  describe('エラーハンドリング', () => {
    it('エラーが発生した場合、エラーメッセージが表示される', async () => {
      mockGetWorktreesWithStatus.mockRejectedValue(new Error('Test error'));

      const { lastFrame } = render(
        React.createElement(WorktreeSelector, {
          onSelect: mockOnSelect,
          onCancel: mockOnCancel,
        })
      );

      await vi.waitFor(() => {
        const frame = lastFrame();
        expect(frame).toContain('Error: Test error');
      });
    });
  });

  describe('空のワークツリー', () => {
    it('ワークツリーが存在しない場合、適切なメッセージが表示される', async () => {
      mockGetWorktreesWithStatus.mockResolvedValue([]);

      const { lastFrame } = render(
        React.createElement(WorktreeSelector, {
          onSelect: mockOnSelect,
          onCancel: mockOnCancel,
        })
      );

      await vi.waitFor(() => {
        const frame = lastFrame();
        expect(frame).toContain('No worktrees found');
      });
    });
  });
});

// getStatusIconのインポートを追加（モックの型チェック用）
import { getStatusIcon } from '../src/utils/presentation.js';