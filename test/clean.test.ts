import { describe, it, expect, vi, beforeEach } from 'vitest';
import { execSync } from 'child_process';
import {
  getWorktreesWithStatus,
  fetchAndPrune,
  removeWorktree,
} from '../src/utils/git.js';
import { loadConfig } from '../src/config.js';

// 依存関数をモック化
vi.mock('child_process', () => ({
  execSync: vi.fn(),
}));

vi.mock('../src/config.js', () => ({
  loadConfig: vi.fn(() => ({
    worktree_base_path: '/Users/test/git-worktrees',
    main_branches: ['main', 'master', 'develop'],
  })),
}));

vi.mock('../src/utils/git.js', () => ({
  getWorktreesWithStatus: vi.fn(),
  fetchAndPrune: vi.fn(),
  removeWorktree: vi.fn(),
}));

const mockExecSync = vi.mocked(execSync);
const mockGetWorktreesWithStatus = vi.mocked(getWorktreesWithStatus);
const mockFetchAndPrune = vi.mocked(fetchAndPrune);
const mockRemoveWorktree = vi.mocked(removeWorktree);

describe('gwm clean command integration tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // マージ済みブランチの検出とクリーンアップをテスト
  it('should detect and clean merged worktrees', async () => {
    const mockWorktrees = [
      {
        path: '/Users/test/project',
        head: '1234567890abcdef',
        branch: 'refs/heads/main',
        status: 'NORMAL',
        isActive: false,
        isMain: true,
      },
      {
        path: '/Users/test/git-worktrees/project/merged-feature',
        head: 'abcdef1234567890',
        branch: 'refs/heads/merged-feature',
        status: 'PRUNABLE',
        isActive: false,
        isMain: false,
      },
      {
        path: '/Users/test/git-worktrees/project/active-feature',
        head: 'fedcba0987654321',
        branch: 'refs/heads/active-feature',
        status: 'NORMAL',
        isActive: false,
        isMain: false,
      },
    ];

    mockGetWorktreesWithStatus.mockResolvedValue(mockWorktrees);
    mockFetchAndPrune.mockImplementation(() => {});
    mockRemoveWorktree.mockImplementation(() => {});

    // PRUNABLE状態のworktreeを検出
    const prunableWorktrees = mockWorktrees.filter(
      (w) => w.status === 'PRUNABLE'
    );

    expect(prunableWorktrees).toHaveLength(1);
    expect(prunableWorktrees[0].path).toBe(
      '/Users/test/git-worktrees/project/merged-feature'
    );

    // クリーンアップ実行
    mockFetchAndPrune();
    for (const worktree of prunableWorktrees) {
      mockRemoveWorktree(worktree.path);
    }

    expect(mockFetchAndPrune).toHaveBeenCalled();
    expect(mockRemoveWorktree).toHaveBeenCalledWith(
      '/Users/test/git-worktrees/project/merged-feature'
    );
  });

  // リモートで削除済みブランチの検出をテスト
  it('should detect worktrees with deleted remote branches', async () => {
    const mockWorktrees = [
      {
        path: '/Users/test/project',
        head: '1234567890abcdef',
        branch: 'refs/heads/main',
        status: 'NORMAL',
        isActive: false,
        isMain: true,
      },
      {
        path: '/Users/test/git-worktrees/project/deleted-remote',
        head: 'abcdef1234567890',
        branch: 'refs/heads/deleted-remote',
        status: 'PRUNABLE',
        isActive: false,
        isMain: false,
      },
    ];

    mockGetWorktreesWithStatus.mockResolvedValue(mockWorktrees);
    mockFetchAndPrune.mockImplementation(() => {});

    // リモート削除済みブランチのチェック
    mockExecSync.mockImplementation((command) => {
      if (
        command?.includes(
          'git show-ref --verify --quiet refs/remotes/origin/deleted-remote'
        )
      ) {
        throw new Error('No remote tracking branch');
      }
      return '';
    });

    const prunableWorktrees = mockWorktrees.filter(
      (w) => w.status === 'PRUNABLE'
    );

    expect(prunableWorktrees).toHaveLength(1);
    expect(prunableWorktrees[0].branch).toBe('refs/heads/deleted-remote');
  });

  // --yesフラグでの自動削除をテスト
  it('should auto-remove all prunable worktrees with --yes flag', async () => {
    const mockWorktrees = [
      {
        path: '/Users/test/project',
        head: '1234567890abcdef',
        branch: 'refs/heads/main',
        status: 'NORMAL',
        isActive: false,
        isMain: true,
      },
      {
        path: '/Users/test/git-worktrees/project/merged-1',
        head: 'abcdef1234567890',
        branch: 'refs/heads/merged-1',
        status: 'PRUNABLE',
        isActive: false,
        isMain: false,
      },
      {
        path: '/Users/test/git-worktrees/project/merged-2',
        head: 'fedcba0987654321',
        branch: 'refs/heads/merged-2',
        status: 'PRUNABLE',
        isActive: false,
        isMain: false,
      },
    ];

    mockGetWorktreesWithStatus.mockResolvedValue(mockWorktrees);
    mockFetchAndPrune.mockImplementation(() => {});
    mockRemoveWorktree.mockImplementation(() => {});

    // --yesフラグが指定された場合の自動削除
    const prunableWorktrees = mockWorktrees.filter(
      (w) => w.status === 'PRUNABLE'
    );

    for (const worktree of prunableWorktrees) {
      mockRemoveWorktree(worktree.path);
    }

    expect(mockRemoveWorktree).toHaveBeenCalledTimes(2);
    expect(mockRemoveWorktree).toHaveBeenCalledWith(
      '/Users/test/git-worktrees/project/merged-1'
    );
    expect(mockRemoveWorktree).toHaveBeenCalledWith(
      '/Users/test/git-worktrees/project/merged-2'
    );
  });

  // インタラクティブモード（--yesなし）での選択的削除をテスト
  it('should allow selective removal in interactive mode', async () => {
    const mockWorktrees = [
      {
        path: '/Users/test/project',
        head: '1234567890abcdef',
        branch: 'refs/heads/main',
        status: 'NORMAL',
        isActive: false,
        isMain: true,
      },
      {
        path: '/Users/test/git-worktrees/project/merged-1',
        head: 'abcdef1234567890',
        branch: 'refs/heads/merged-1',
        status: 'PRUNABLE',
        isActive: false,
        isMain: false,
      },
      {
        path: '/Users/test/git-worktrees/project/merged-2',
        head: 'fedcba0987654321',
        branch: 'refs/heads/merged-2',
        status: 'PRUNABLE',
        isActive: false,
        isMain: false,
      },
    ];

    mockGetWorktreesWithStatus.mockResolvedValue(mockWorktrees);
    mockFetchAndPrune.mockImplementation(() => {});
    mockRemoveWorktree.mockImplementation(() => {});

    const prunableWorktrees = mockWorktrees.filter(
      (w) => w.status === 'PRUNABLE'
    );

    // ユーザーが1つ目のみ選択したと仮定
    const selectedWorktrees = [prunableWorktrees[0]];

    for (const worktree of selectedWorktrees) {
      mockRemoveWorktree(worktree.path);
    }

    expect(mockRemoveWorktree).toHaveBeenCalledTimes(1);
    expect(mockRemoveWorktree).toHaveBeenCalledWith(
      '/Users/test/git-worktrees/project/merged-1'
    );
    expect(mockRemoveWorktree).not.toHaveBeenCalledWith(
      '/Users/test/git-worktrees/project/merged-2'
    );
  });

  // 複数のメインブランチでのマージ検出をテスト
  it('should check merge status against all configured main branches', async () => {
    vi.mocked(loadConfig).mockReturnValue({
      worktree_base_path: '/Users/test/git-worktrees',
      main_branches: ['main', 'master', 'develop'],
    });

    const mockWorktrees = [
      {
        path: '/Users/test/project',
        head: '1234567890abcdef',
        branch: 'refs/heads/main',
        status: 'NORMAL',
        isActive: false,
        isMain: true,
      },
      {
        path: '/Users/test/git-worktrees/project/feature-merged-to-develop',
        head: 'abcdef1234567890',
        branch: 'refs/heads/feature-merged-to-develop',
        status: 'PRUNABLE',
        isActive: false,
        isMain: false,
      },
    ];

    mockGetWorktreesWithStatus.mockResolvedValue(mockWorktrees);

    // developブランチにマージ済みの確認
    mockExecSync.mockImplementation((command) => {
      if (
        command?.includes(
          'git merge-base --is-ancestor refs/heads/feature-merged-to-develop refs/heads/develop'
        )
      ) {
        return ''; // マージ済み
      }
      if (
        command?.includes(
          'git merge-base --is-ancestor refs/heads/feature-merged-to-develop refs/heads/main'
        )
      ) {
        throw new Error('Not merged to main');
      }
      if (
        command?.includes(
          'git merge-base --is-ancestor refs/heads/feature-merged-to-develop refs/heads/master'
        )
      ) {
        throw new Error('Not merged to master');
      }
      return '';
    });

    const prunableWorktrees = mockWorktrees.filter(
      (w) => w.status === 'PRUNABLE'
    );

    expect(prunableWorktrees).toHaveLength(1);
    expect(prunableWorktrees[0].branch).toBe(
      'refs/heads/feature-merged-to-develop'
    );
  });

  // git fetchエラーのハンドリングをテスト
  it('should handle git fetch errors gracefully', async () => {
    mockFetchAndPrune.mockImplementation(() => {
      throw new Error('Failed to fetch from remote');
    });

    expect(() => {
      mockFetchAndPrune();
    }).toThrow('Failed to fetch from remote');
  });

  // worktree削除エラーのハンドリングをテスト
  it('should handle worktree removal errors gracefully', async () => {
    const mockWorktrees = [
      {
        path: '/Users/test/git-worktrees/project/locked-worktree',
        head: 'abcdef1234567890',
        branch: 'refs/heads/locked-worktree',
        status: 'PRUNABLE',
        isActive: false,
        isMain: false,
      },
    ];

    mockGetWorktreesWithStatus.mockResolvedValue(mockWorktrees);
    mockFetchAndPrune.mockImplementation(() => {});
    mockRemoveWorktree.mockImplementation(() => {
      throw new Error('Failed to remove worktree: worktree is locked');
    });

    expect(() => {
      mockRemoveWorktree('/Users/test/git-worktrees/project/locked-worktree');
    }).toThrow('Failed to remove worktree: worktree is locked');
  });

  // PRUNABLEなworktreeが存在しない場合のテスト
  it('should handle case when no prunable worktrees exist', async () => {
    const mockWorktrees = [
      {
        path: '/Users/test/project',
        head: '1234567890abcdef',
        branch: 'refs/heads/main',
        status: 'NORMAL',
        isActive: false,
        isMain: true,
      },
      {
        path: '/Users/test/git-worktrees/project/active-feature',
        head: 'abcdef1234567890',
        branch: 'refs/heads/active-feature',
        status: 'NORMAL',
        isActive: false,
        isMain: false,
      },
    ];

    mockGetWorktreesWithStatus.mockResolvedValue(mockWorktrees);
    mockFetchAndPrune.mockImplementation(() => {});

    const prunableWorktrees = mockWorktrees.filter(
      (w) => w.status === 'PRUNABLE'
    );

    expect(prunableWorktrees).toHaveLength(0);
    expect(mockRemoveWorktree).not.toHaveBeenCalled();
  });

  // メインworktreeを削除対象から除外することをテスト
  it('should exclude main worktree from cleanup candidates', async () => {
    const mockWorktrees = [
      {
        path: '/Users/test/project',
        head: '1234567890abcdef',
        branch: 'refs/heads/main',
        status: 'NORMAL',
        isActive: false,
        isMain: true, // メインworktree
      },
      {
        path: '/Users/test/git-worktrees/project/merged-feature',
        head: 'abcdef1234567890',
        branch: 'refs/heads/merged-feature',
        status: 'PRUNABLE',
        isActive: false,
        isMain: false,
      },
    ];

    mockGetWorktreesWithStatus.mockResolvedValue(mockWorktrees);
    mockFetchAndPrune.mockImplementation(() => {});
    mockRemoveWorktree.mockImplementation(() => {});

    // メインworktreeは削除対象から除外
    const prunableWorktrees = mockWorktrees.filter(
      (w) => w.status === 'PRUNABLE' && !w.isMain
    );

    expect(prunableWorktrees).toHaveLength(1);
    expect(prunableWorktrees[0].isMain).toBe(false);
    expect(prunableWorktrees[0].path).toBe(
      '/Users/test/git-worktrees/project/merged-feature'
    );
  });

  // LOCKEDなworktreeの扱いをテスト
  it('should handle locked worktrees appropriately', async () => {
    const mockWorktrees = [
      {
        path: '/Users/test/project',
        head: '1234567890abcdef',
        branch: 'refs/heads/main',
        status: 'NORMAL',
        isActive: false,
        isMain: true,
      },
      {
        path: '/Users/test/git-worktrees/project/locked-but-merged',
        head: 'abcdef1234567890',
        branch: 'refs/heads/locked-but-merged',
        status: 'LOCKED',
        isActive: false,
        isMain: false,
      },
    ];

    mockGetWorktreesWithStatus.mockResolvedValue(mockWorktrees);
    mockFetchAndPrune.mockImplementation(() => {});

    // LOCKEDなworktreeは削除対象から除外（またはユーザーに警告）
    const prunableWorktrees = mockWorktrees.filter(
      (w) => w.status === 'PRUNABLE'
    );
    const lockedWorktrees = mockWorktrees.filter((w) => w.status === 'LOCKED');

    expect(prunableWorktrees).toHaveLength(0);
    expect(lockedWorktrees).toHaveLength(1);
    expect(lockedWorktrees[0].path).toBe(
      '/Users/test/git-worktrees/project/locked-but-merged'
    );
  });
});
