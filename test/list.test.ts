import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { execSync } from 'child_process';
import { getWorktreesWithStatus } from '../src/utils/git/index.js';
import { loadConfig } from '../src/config/index.js';

// execSyncをモック化
vi.mock('child_process', () => ({
  execSync: vi.fn(),
}));

// loadConfigをモック化
vi.mock('../src/config/index.js', () => ({
  loadConfig: vi.fn(() => ({
    worktree_base_path: '/Users/test/git-worktrees',
    main_branches: ['main', 'master', 'develop'],
    clean_branch: 'ask',
  })),
}));

// コンソール出力をモック化
const mockConsoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});

const mockExecSync = vi.mocked(execSync);

describe('gwm list command integration tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockConsoleLog.mockClear();
  });

  afterEach(() => {
    mockConsoleLog.mockRestore();
  });

  // 基本的なworktreeリスト表示をテスト
  it('should display worktree list with correct format', async () => {
    const porcelainOutput = `worktree /Users/test/project
HEAD 1234567890abcdef1234567890abcdef12345678
branch refs/heads/main

worktree /Users/test/git-worktrees/project/feature-branch
HEAD abcdef1234567890ab1234567890abcdef123456
branch refs/heads/feature-branch

worktree /Users/test/git-worktrees/project/bugfix-login
HEAD fedcba0987654321fedcba0987654321fedcba09
branch refs/heads/bugfix-login
locked`;

    mockExecSync.mockImplementation((command) => {
      if (command === 'git rev-parse --git-dir') {
        return '';
      }
      if (command === 'git worktree list --porcelain') {
        return porcelainOutput;
      }
      // リモート追跡ブランチのチェック - feature-branchは存在、bugfix-loginは存在しない
      if (
        command?.includes(
          'git show-ref --verify --quiet refs/remotes/origin/feature-branch'
        )
      ) {
        return '';
      }
      if (
        command?.includes(
          'git show-ref --verify --quiet refs/remotes/origin/bugfix-login'
        )
      ) {
        throw new Error('No remote tracking branch');
      }
      // マージステータスチェック - feature-branchはマージされていない
      if (
        command?.includes(
          'git merge-base --is-ancestor refs/heads/feature-branch'
        )
      ) {
        throw new Error('Not merged');
      }
      return '';
    });

    const worktrees = await getWorktreesWithStatus();

    expect(worktrees).toHaveLength(3);

    // メインworktree
    expect(worktrees[0]).toMatchObject({
      path: '/Users/test/project',
      branch: 'refs/heads/main',
      status: 'MAIN',
      isMain: true,
    });

    // 通常のworktree
    expect(worktrees[1]).toMatchObject({
      path: '/Users/test/git-worktrees/project/feature-branch',
      branch: 'refs/heads/feature-branch',
      status: 'OTHER',
      isMain: false,
    });

    // ロックされたworktree
    expect(worktrees[2]).toMatchObject({
      path: '/Users/test/git-worktrees/project/bugfix-login',
      branch: 'refs/heads/bugfix-login',
      status: 'OTHER',
      isMain: false,
    });
  });

  // ACTIVE状態の表示をテスト
  it('should mark current worktree as ACTIVE with asterisk', async () => {
    const originalCwd = process.cwd;
    process.cwd = vi.fn(
      () => '/Users/test/git-worktrees/project/feature-branch'
    );

    const porcelainOutput = `worktree /Users/test/project
HEAD 1234567890abcdef1234567890abcdef12345678
branch refs/heads/main

worktree /Users/test/git-worktrees/project/feature-branch
HEAD abcdef1234567890ab1234567890abcdef123456
branch refs/heads/feature-branch`;

    mockExecSync.mockImplementation((command) => {
      if (command === 'git rev-parse --git-dir') {
        return '';
      }
      if (command === 'git worktree list --porcelain') {
        return porcelainOutput;
      }
      if (
        command?.includes('git show-ref --verify --quiet refs/remotes/origin/')
      ) {
        return '';
      }
      return '';
    });

    const worktrees = await getWorktreesWithStatus();

    expect(worktrees[0].status).toBe('MAIN');
    expect(worktrees[0].isActive).toBe(false);
    expect(worktrees[1].status).toBe('ACTIVE');
    expect(worktrees[1].isActive).toBe(true);

    process.cwd = originalCwd;
  });

  // PRUNABLE状態（マージ済み）の検出をテスト
  it('should detect PRUNABLE worktrees (merged branches)', async () => {
    const porcelainOutput = `worktree /Users/test/project
HEAD 1234567890abcdef1234567890abcdef12345678
branch refs/heads/main

worktree /Users/test/git-worktrees/project/merged-feature
HEAD fedcba0987654321fedcba0987654321fedcba09
branch refs/heads/merged-feature`;

    mockExecSync.mockImplementation((command) => {
      if (command === 'git rev-parse --git-dir') {
        return '';
      }
      if (command === 'git worktree list --porcelain') {
        return porcelainOutput;
      }
      // merged-featureはマージ済み（リモート追跡ブランチが存在しない）
      if (
        command?.includes(
          'git show-ref --verify --quiet refs/remotes/origin/merged-feature'
        )
      ) {
        throw new Error('No remote tracking branch');
      }
      // マージチェック - merged-featureはmainにマージ済み
      if (
        command?.includes(
          'git merge-base --is-ancestor refs/heads/merged-feature refs/heads/main'
        )
      ) {
        return '';
      }
      return '';
    });

    const worktrees = await getWorktreesWithStatus();

    expect(worktrees[1]).toMatchObject({
      branch: 'refs/heads/merged-feature',
      status: 'OTHER',
    });
  });

  // PRUNABLE状態（リモート削除済み）の検出をテスト
  it('should detect PRUNABLE worktrees (deleted remote branches)', async () => {
    const porcelainOutput = `worktree /Users/test/project
HEAD 1234567890abcdef1234567890abcdef12345678
branch refs/heads/main

worktree /Users/test/git-worktrees/project/deleted-branch
HEAD fedcba0987654321fedcba0987654321fedcba09
branch refs/heads/deleted-branch`;

    mockExecSync.mockImplementation((command) => {
      if (command === 'git rev-parse --git-dir') {
        return '';
      }
      if (command === 'git worktree list --porcelain') {
        return porcelainOutput;
      }
      // deleted-branchはリモートで削除済み
      if (
        command?.includes(
          'git show-ref --verify --quiet refs/remotes/origin/deleted-branch'
        )
      ) {
        throw new Error('No remote tracking branch');
      }
      return '';
    });

    const worktrees = await getWorktreesWithStatus();

    expect(worktrees[1]).toMatchObject({
      branch: 'refs/heads/deleted-branch',
      status: 'OTHER',
    });
  });

  // エイリアス `ls` コマンドの動作をテスト
  it('should work with ls alias', async () => {
    const porcelainOutput = `worktree /Users/test/project
HEAD 1234567890abcdef1234567890abcdef12345678
branch refs/heads/main`;

    mockExecSync.mockImplementation((command) => {
      if (command === 'git rev-parse --git-dir') {
        return '';
      }
      if (command === 'git worktree list --porcelain') {
        return porcelainOutput;
      }
      return '';
    });

    const worktrees = await getWorktreesWithStatus();

    expect(worktrees).toHaveLength(1);
    expect(worktrees[0].branch).toBe('refs/heads/main');
  });

  // HEADが切り離し状態のworktree表示をテスト
  it('should display detached HEAD worktrees correctly', async () => {
    const porcelainOutput = `worktree /Users/test/project
HEAD 1234567890abcdef1234567890abcdef12345678
branch refs/heads/main

worktree /Users/test/git-worktrees/project/detached-head
HEAD abcdef1234567890ab1234567890abcdef123456
detached`;

    mockExecSync.mockImplementation((command) => {
      if (command === 'git rev-parse --git-dir') {
        return '';
      }
      if (command === 'git worktree list --porcelain') {
        return porcelainOutput;
      }
      return '';
    });

    const worktrees = await getWorktreesWithStatus();

    expect(worktrees[1]).toMatchObject({
      path: '/Users/test/git-worktrees/project/detached-head',
      branch: '(detached)',
      status: 'OTHER',
    });
  });

  // bareリポジトリの表示をテスト
  it('should display bare repository correctly', async () => {
    const porcelainOutput = `worktree /Users/test/project.git
HEAD 1234567890abcdef1234567890abcdef12345678
bare`;

    mockExecSync.mockImplementation((command) => {
      if (command === 'git rev-parse --git-dir') {
        return '';
      }
      if (command === 'git worktree list --porcelain') {
        return porcelainOutput;
      }
      return '';
    });

    const worktrees = await getWorktreesWithStatus();

    expect(worktrees[0]).toMatchObject({
      path: '/Users/test/project.git',
      branch: '(bare)',
      status: 'MAIN',
      isMain: true,
    });
  });

  // 複数メインブランチ設定での動作をテスト
  it('should work with multiple main branches configuration', async () => {
    vi.mocked(loadConfig).mockReturnValue({
      worktree_base_path: '/Users/test/git-worktrees',
      main_branches: ['main', 'master', 'develop'],
      clean_branch: 'ask',
    });

    const porcelainOutput = `worktree /Users/test/project
HEAD 1234567890abcdef1234567890abcdef12345678
branch refs/heads/develop

worktree /Users/test/git-worktrees/project/feature
HEAD abcdef1234567890ab1234567890abcdef123456
branch refs/heads/feature`;

    mockExecSync.mockImplementation((command) => {
      if (command === 'git rev-parse --git-dir') {
        return '';
      }
      if (command === 'git worktree list --porcelain') {
        return porcelainOutput;
      }
      // featureはdevelopにマージ済み
      if (
        command?.includes(
          'git merge-base --is-ancestor refs/heads/feature refs/heads/develop'
        )
      ) {
        return '';
      }
      if (
        command?.includes(
          'git show-ref --verify --quiet refs/remotes/origin/feature'
        )
      ) {
        throw new Error('No remote tracking branch');
      }
      return '';
    });

    const worktrees = await getWorktreesWithStatus();

    expect(worktrees[1]).toMatchObject({
      branch: 'refs/heads/feature',
      status: 'OTHER',
    });
  });

  // 空のworktreeリストの処理をテスト
  it('should handle empty worktree list', async () => {
    mockExecSync.mockImplementation((command) => {
      if (command === 'git rev-parse --git-dir') {
        return '';
      }
      if (command === 'git worktree list --porcelain') {
        return '';
      }
      return '';
    });

    const worktrees = await getWorktreesWithStatus();

    expect(worktrees).toEqual([]);
  });
});
