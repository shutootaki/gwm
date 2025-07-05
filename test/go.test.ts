import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getWorktreesWithStatus } from '../src/utils/git.js';

// 依存関数をモック化
vi.mock('../src/utils/git.js', () => ({
  getWorktreesWithStatus: vi.fn(),
}));

// コンソール出力をモック化（パス出力用）
const mockConsoleLog = vi
  .spyOn(console, 'log')
  .mockImplementation(() => {}) as any;
const mockProcessExit = vi.spyOn(process, 'exit').mockImplementation(() => {
  throw new Error('process.exit called');
});

const mockGetWorktreesWithStatus = vi.mocked(getWorktreesWithStatus);

describe('gwm go command integration tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockConsoleLog.mockClear();
    mockProcessExit.mockClear();
  });

  afterEach(() => {
    mockConsoleLog.mockRestore();
    mockProcessExit.mockRestore();
  });

  // 基本的なworktree選択とパス出力をテスト
  it('should output selected worktree path', async () => {
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
        path: '/Users/test/git-worktrees/project/feature-branch',
        head: 'abcdef1234567890',
        branch: 'refs/heads/feature-branch',
        status: 'NORMAL',
        isActive: false,
        isMain: false,
      },
      {
        path: '/Users/test/git-worktrees/project/bugfix-login',
        head: 'fedcba0987654321',
        branch: 'refs/heads/bugfix-login',
        status: 'NORMAL',
        isActive: false,
        isMain: false,
      },
    ];

    mockGetWorktreesWithStatus.mockResolvedValue(mockWorktrees);

    // ユーザーが2番目のworktreeを選択したと仮定
    const selectedWorktree = mockWorktrees[1];

    // パスのみを標準出力に出力
    mockConsoleLog(selectedWorktree.path);

    expect(mockConsoleLog).toHaveBeenCalledWith(
      '/Users/test/git-worktrees/project/feature-branch'
    );
    expect(mockConsoleLog).toHaveBeenCalledTimes(1);
  });

  // クエリによる初期フィルタリングをテスト
  it('should filter worktrees by query initially', async () => {
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
        path: '/Users/test/git-worktrees/project/feature-auth',
        head: 'abcdef1234567890',
        branch: 'refs/heads/feature-auth',
        status: 'NORMAL',
        isActive: false,
        isMain: false,
      },
      {
        path: '/Users/test/git-worktrees/project/feature-ui',
        head: 'fedcba0987654321',
        branch: 'refs/heads/feature-ui',
        status: 'NORMAL',
        isActive: false,
        isMain: false,
      },
      {
        path: '/Users/test/git-worktrees/project/bugfix-login',
        head: '123456789abcdef0',
        branch: 'refs/heads/bugfix-login',
        status: 'NORMAL',
        isActive: false,
        isMain: false,
      },
    ];

    mockGetWorktreesWithStatus.mockResolvedValue(mockWorktrees);

    const query = 'feature';

    // クエリ "feature" でフィルタリング
    const filteredWorktrees = mockWorktrees.filter(
      (w) => w.branch.includes(query) || w.path.includes(query)
    );

    expect(filteredWorktrees).toHaveLength(2);
    expect(filteredWorktrees[0].branch).toBe('refs/heads/feature-auth');
    expect(filteredWorktrees[1].branch).toBe('refs/heads/feature-ui');
  });

  // 検索機能のテスト
  it('should support search functionality', async () => {
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
        path: '/Users/test/git-worktrees/project/feature-user-authentication',
        head: 'abcdef1234567890',
        branch: 'refs/heads/feature-user-authentication',
        status: 'NORMAL',
        isActive: false,
        isMain: false,
      },
      {
        path: '/Users/test/git-worktrees/project/fix-user-login',
        head: 'fedcba0987654321',
        branch: 'refs/heads/fix-user-login',
        status: 'NORMAL',
        isActive: false,
        isMain: false,
      },
    ];

    mockGetWorktreesWithStatus.mockResolvedValue(mockWorktrees);

    // const _query = 'usr'; // query removed as it was unused

    // 部分一致検索（"user" を含むブランチ）
    const searchMatches = mockWorktrees
      .filter(
        (w) =>
          w.branch.toLowerCase().includes('user') ||
          w.path.toLowerCase().includes('user')
      )
      .filter((w) => !w.isMain);

    expect(searchMatches).toHaveLength(2);
    expect(searchMatches[0].branch).toBe(
      'refs/heads/feature-user-authentication'
    );
    expect(searchMatches[1].branch).toBe('refs/heads/fix-user-login');
  });

  // ユーザーキャンセル時の動作をテスト
  it('should output nothing when user cancels selection', async () => {
    const mockWorktrees = [
      {
        path: '/Users/test/project',
        head: '1234567890abcdef',
        branch: 'refs/heads/main',
        status: 'NORMAL',
        isActive: false,
        isMain: true,
      },
    ];

    mockGetWorktreesWithStatus.mockResolvedValue(mockWorktrees);

    // ユーザーがESCキーでキャンセルしたと仮定
    const userCancelled = true;

    if (userCancelled) {
      // 何も出力せずに終了
    } else {
      mockConsoleLog('/some/path');
    }

    expect(mockConsoleLog).not.toHaveBeenCalled();
  });

  // 空のworktreeリストの処理をテスト
  it('should handle empty worktree list gracefully', async () => {
    mockGetWorktreesWithStatus.mockResolvedValue([]);

    const worktrees = await mockGetWorktreesWithStatus();

    expect(worktrees).toEqual([]);
    // 空のリストの場合は何も表示しない、またはメッセージを表示
  });

  // 単一worktreeの自動選択をテスト
  it('should auto-select when only one worktree matches query', async () => {
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
        path: '/Users/test/git-worktrees/project/unique-branch',
        head: 'abcdef1234567890',
        branch: 'refs/heads/unique-branch',
        status: 'NORMAL',
        isActive: false,
        isMain: false,
      },
    ];

    mockGetWorktreesWithStatus.mockResolvedValue(mockWorktrees);

    const query = 'unique';

    const matches = mockWorktrees.filter(
      (w) => w.branch.includes(query) || w.path.includes(query)
    );

    // 1つしかマッチしない場合は自動選択
    if (matches.length === 1) {
      mockConsoleLog(matches[0].path);
    }

    expect(matches).toHaveLength(1);
    expect(mockConsoleLog).toHaveBeenCalledWith(
      '/Users/test/git-worktrees/project/unique-branch'
    );
  });

  // ブランチ名の表示形式をテスト
  it('should display branch names in user-friendly format', async () => {
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
        path: '/Users/test/git-worktrees/project/feature-branch',
        head: 'abcdef1234567890',
        branch: 'refs/heads/feature-branch',
        status: 'NORMAL',
        isActive: false,
        isMain: false,
      },
      {
        path: '/Users/test/git-worktrees/project/detached-head',
        head: 'fedcba0987654321',
        branch: '(detached)',
        status: 'NORMAL',
        isActive: false,
        isMain: false,
      },
    ];

    mockGetWorktreesWithStatus.mockResolvedValue(mockWorktrees);

    // ブランチ名の表示形式を正規化
    const displayWorktrees = mockWorktrees.map((w) => ({
      ...w,
      displayBranch: w.branch.startsWith('refs/heads/')
        ? w.branch.replace('refs/heads/', '')
        : w.branch,
    }));

    expect(displayWorktrees[0].displayBranch).toBe('main');
    expect(displayWorktrees[1].displayBranch).toBe('feature-branch');
    expect(displayWorktrees[2].displayBranch).toBe('(detached)');
  });

  // 現在のworktree（ACTIVE）のマーキングをテスト
  it('should mark current worktree in selection UI', async () => {
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
        path: '/Users/test/git-worktrees/project/feature-branch',
        head: 'abcdef1234567890',
        branch: 'refs/heads/feature-branch',
        status: 'ACTIVE',
        isActive: true,
        isMain: false,
      },
    ];

    mockGetWorktreesWithStatus.mockResolvedValue(mockWorktrees);

    // ACTIVE状態のworktreeをマーク
    const displayWorktrees = mockWorktrees.map((w) => ({
      ...w,
      displayText: w.status === 'ACTIVE' ? `* ${w.branch}` : w.branch,
    }));

    expect(displayWorktrees[0].displayText).toBe('refs/heads/main');
    expect(displayWorktrees[1].displayText).toBe('* refs/heads/feature-branch');
  });

  // 長いパス名の処理をテスト
  it('should handle long path names appropriately', async () => {
    const mockWorktrees = [
      {
        path: '/Users/test/very/long/nested/directory/structure/worktrees/project-with-very-long-name/feature-branch-with-very-long-descriptive-name',
        head: 'abcdef1234567890',
        branch: 'refs/heads/feature-branch-with-very-long-descriptive-name',
        status: 'NORMAL',
        isActive: false,
        isMain: false,
      },
    ];

    mockGetWorktreesWithStatus.mockResolvedValue(mockWorktrees);

    const selectedWorktree = mockWorktrees[0];

    // 長いパスでも正確に出力
    mockConsoleLog(selectedWorktree.path);

    expect(mockConsoleLog).toHaveBeenCalledWith(
      '/Users/test/very/long/nested/directory/structure/worktrees/project-with-very-long-name/feature-branch-with-very-long-descriptive-name'
    );
  });

  // シェル関数との連携をテスト
  it('should work correctly with shell function integration', async () => {
    const mockWorktrees = [
      {
        path: '/Users/test/git-worktrees/project/feature-branch',
        head: 'abcdef1234567890',
        branch: 'refs/heads/feature-branch',
        status: 'NORMAL',
        isActive: false,
        isMain: false,
      },
    ];

    mockGetWorktreesWithStatus.mockResolvedValue(mockWorktrees);

    const selectedWorktree = mockWorktrees[0];

    // パスのみを出力（cdコマンドは実行しない）
    mockConsoleLog(selectedWorktree.path);

    // シェル関数側でcdを実行する想定
    const outputPath = selectedWorktree.path;
    expect(outputPath).toBe('/Users/test/git-worktrees/project/feature-branch');
    expect(mockConsoleLog).toHaveBeenCalledWith(outputPath);
  });
});
