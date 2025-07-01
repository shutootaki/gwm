import { describe, it, expect, vi, beforeEach } from 'vitest';
import { execSync } from 'child_process';
import {
  parseWorktrees,
  getWorktreesWithStatus,
  fetchAndPrune,
  removeWorktree,
} from '../src/utils/git.js';

// execSyncをモック化
vi.mock('child_process', () => ({
  execSync: vi.fn(),
}));

// loadConfigをモック化
vi.mock('../src/config.js', () => ({
  loadConfig: vi.fn(() => ({
    worktree_base_path: '/Users/test/git-worktrees',
    main_branches: ['main', 'master'],
    clean_branch: 'ask',
  })),
}));

const mockExecSync = vi.mocked(execSync);

describe('parseWorktrees', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // git worktree list --porcelain出力の正常な解析をテスト
  it('should parse git worktree list --porcelain output correctly', () => {
    const porcelainOutput = `worktree /Users/test/project
HEAD 1234567890abcdef1234567890abcdef12345678
branch refs/heads/main

worktree /Users/test/git-worktrees/project/feature-1
HEAD abcdef1234567890abcdef1234567890abcdef12
branch refs/heads/feature-1

worktree /Users/test/git-worktrees/project/feature-2
HEAD fedcba0987654321fedcba0987654321fedcba09
branch refs/heads/feature-2
locked`;

    const result = parseWorktrees(porcelainOutput);

    expect(result).toHaveLength(3);

    // メインworktree
    expect(result[0]).toEqual({
      path: '/Users/test/project',
      head: '1234567890abcdef1234567890abcdef12345678',
      branch: 'refs/heads/main',
      status: 'MAIN',
      isActive: false,
      isMain: true,
    });

    // feature-1 worktree
    expect(result[1]).toEqual({
      path: '/Users/test/git-worktrees/project/feature-1',
      head: 'abcdef1234567890abcdef1234567890abcdef12',
      branch: 'refs/heads/feature-1',
      status: 'OTHER',
      isActive: false,
      isMain: false,
    });

    // feature-2 worktree (locked)
    expect(result[2]).toEqual({
      path: '/Users/test/git-worktrees/project/feature-2',
      head: 'fedcba0987654321fedcba0987654321fedcba09',
      branch: 'refs/heads/feature-2',
      status: 'OTHER',
      isActive: false,
      isMain: false,
    });
  });

  // bareリポジトリの解析をテスト
  it('should handle bare repository correctly', () => {
    const porcelainOutput = `worktree /Users/test/project.git
HEAD 1234567890abcdef1234567890abcdef12345678
bare`;

    const result = parseWorktrees(porcelainOutput);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      path: '/Users/test/project.git',
      head: '1234567890abcdef1234567890abcdef12345678',
      branch: '(bare)',
      status: 'MAIN',
      isActive: false,
      isMain: true,
    });
  });

  // HEADが切り離し状態のworktreeの解析をテスト
  it('should handle detached HEAD correctly', () => {
    const porcelainOutput = `worktree /Users/test/project
HEAD 1234567890abcdef1234567890abcdef12345678
detached`;

    const result = parseWorktrees(porcelainOutput);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      path: '/Users/test/project',
      head: '1234567890abcdef1234567890abcdef12345678',
      branch: '(detached)',
      status: 'MAIN',
      isActive: false,
      isMain: true,
    });
  });

  // 現在のディレクトリをACTIVE状態にマークする機能をテスト
  it('should mark current directory as ACTIVE', () => {
    const originalCwd = process.cwd;
    process.cwd = vi.fn(() => '/Users/test/git-worktrees/project/feature-1');

    const porcelainOutput = `worktree /Users/test/project
HEAD 1234567890abcdef1234567890abcdef12345678
branch refs/heads/main

worktree /Users/test/git-worktrees/project/feature-1
HEAD abcdef1234567890abcdef1234567890abcdef12
branch refs/heads/feature-1`;

    const result = parseWorktrees(porcelainOutput);

    expect(result[0].isActive).toBe(false);
    expect(result[0].status).toBe('MAIN');
    expect(result[1].isActive).toBe(true);
    expect(result[1].status).toBe('ACTIVE');

    process.cwd = originalCwd;
  });
});

describe('getWorktreesWithStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Gitリポジトリでない場所でのエラーハンドリングをテスト
  it('should throw error when not in git repository', async () => {
    mockExecSync.mockImplementation((command) => {
      if (command === 'git rev-parse --git-dir') {
        throw new Error('Not a git repository');
      }
      return '';
    });

    await expect(getWorktreesWithStatus()).rejects.toThrow(
      'Not a git repository. Please run this command from within a git repository.'
    );
  });

  // ステータス付きworktreeリストの取得をテスト
  it('should return worktrees with status', async () => {
    const porcelainOutput = `worktree /Users/test/project
HEAD 1234567890abcdef1234567890abcdef12345678
branch refs/heads/main

worktree /Users/test/git-worktrees/project/feature-1
HEAD abcdef1234567890abcdef1234567890abcdef12
branch refs/heads/feature-1`;

    mockExecSync.mockImplementation((command) => {
      if (command === 'git rev-parse --git-dir') {
        return '';
      }
      if (command === 'git worktree list --porcelain') {
        return porcelainOutput;
      }
      return '';
    });

    const result = await getWorktreesWithStatus();

    expect(result).toHaveLength(2);
    expect(result[0].status).toBe('MAIN');
    expect(result[1].status).toBe('OTHER');
  });
});

describe('fetchAndPrune', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // git fetch --prune originの正常実行をテスト
  it('should execute git fetch --prune origin successfully', () => {
    mockExecSync.mockReturnValue('');

    expect(() => fetchAndPrune()).not.toThrow();
    expect(mockExecSync).toHaveBeenCalledWith('git fetch --prune origin', {
      stdio: 'ignore',
      cwd: process.cwd(),
    });
  });

  // リモートoriginが存在しない場合のエラーハンドリングをテスト
  it('should throw error when no remote origin exists', () => {
    mockExecSync.mockImplementation(() => {
      const error = new Error("No such remote 'origin'");
      throw error;
    });

    expect(() => fetchAndPrune()).toThrow(
      'No remote named "origin" found. Please configure a remote repository.'
    );
  });

  // その他のエラーの汎用エラーハンドリングをテスト
  it('should throw generic error for other failures', () => {
    mockExecSync.mockImplementation(() => {
      throw new Error('Network error');
    });

    expect(() => fetchAndPrune()).toThrow(
      'Failed to fetch and prune from remote: Network error'
    );
  });
});

describe('removeWorktree', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // worktreeの正常な削除をテスト
  it('should remove worktree successfully', () => {
    mockExecSync.mockReturnValue('');

    expect(() => removeWorktree('/path/to/worktree')).not.toThrow();
    expect(mockExecSync).toHaveBeenCalledWith(
      "git worktree remove '/path/to/worktree'",
      { cwd: process.cwd() }
    );
  });

  // --forceフラグ付きworktree削除をテスト
  it('should remove worktree with force flag', () => {
    mockExecSync.mockReturnValue('');

    expect(() => removeWorktree('/path/to/worktree', true)).not.toThrow();
    expect(mockExecSync).toHaveBeenCalledWith(
      "git worktree remove '/path/to/worktree' --force",
      { cwd: process.cwd() }
    );
  });

  // worktree削除失敗時のエラーハンドリングをテスト
  it('should throw error when removal fails', () => {
    mockExecSync.mockImplementation(() => {
      throw new Error('worktree has uncommitted changes');
    });

    expect(() => removeWorktree('/path/to/worktree')).toThrow(
      'Failed to remove worktree /path/to/worktree: worktree has uncommitted changes'
    );
  });
});
