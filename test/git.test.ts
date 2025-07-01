import { describe, it, expect, vi, beforeEach } from 'vitest';
import { execSync } from 'child_process';
import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import {
  parseWorktrees,
  getWorktreesWithStatus,
  fetchAndPrune,
  removeWorktree,
  getMainWorktreePath,
  getIgnoredFiles,
  copyFiles,
} from '../src/utils/git.js';

// execSyncをモック化
vi.mock('child_process', () => ({
  execSync: vi.fn(),
}));

// fsモジュールをモック化
vi.mock('fs', () => ({
  copyFileSync: vi.fn(),
  existsSync: vi.fn(),
  mkdirSync: vi.fn(),
  readdirSync: vi.fn(),
  statSync: vi.fn(),
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
const mockCopyFileSync = vi.mocked(copyFileSync);
const mockExistsSync = vi.mocked(existsSync);
const mockMkdirSync = vi.mocked(mkdirSync);
const mockReaddirSync = vi.mocked(readdirSync);
const mockStatSync = vi.mocked(statSync);

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

describe('getMainWorktreePath', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // メインワークツリーパスの正常な取得をテスト
  it('should return main worktree path when isMain flag is set', () => {
    const porcelainOutput = `worktree /Users/test/project
HEAD 1234567890abcdef1234567890abcdef12345678
branch refs/heads/main

worktree /Users/test/git-worktrees/project/feature-1
HEAD abcdef1234567890abcdef1234567890abcdef12
branch refs/heads/feature-1`;

    mockExecSync.mockImplementation((command) => {
      if (command === 'git worktree list --porcelain') {
        return porcelainOutput;
      }
      return '';
    });

    const result = getMainWorktreePath();
    expect(result).toBe('/Users/test/project');
  });

  // bareリポジトリのメインワークツリーパスをテスト
  it('should return bare repository path as main', () => {
    const porcelainOutput = `worktree /Users/test/project.git
HEAD 1234567890abcdef1234567890abcdef12345678
bare`;

    mockExecSync.mockImplementation((command) => {
      if (command === 'git worktree list --porcelain') {
        return porcelainOutput;
      }
      return '';
    });

    const result = getMainWorktreePath();
    expect(result).toBe('/Users/test/project.git');
  });

  // ワークツリーが存在しない場合のnull返却をテスト
  it('should return null when no worktrees exist', () => {
    mockExecSync.mockImplementation((command) => {
      if (command === 'git worktree list --porcelain') {
        return '';
      }
      return '';
    });

    const result = getMainWorktreePath();
    expect(result).toBeNull();
  });

  // エラー発生時のnull返却をテスト
  it('should return null on error', () => {
    mockExecSync.mockImplementation(() => {
      throw new Error('Command failed');
    });

    const result = getMainWorktreePath();
    expect(result).toBeNull();
  });
});

describe('getIgnoredFiles', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // gitignoreされたファイルの検出をテスト
  it('should find ignored files matching patterns', () => {
    const workdir = '/Users/test/project';
    const patterns = ['.env', '.env.*'];
    const excludePatterns = ['.env.example'];

    // ディレクトリ構造のモック設定
    mockReaddirSync.mockImplementation((dir) => {
      if (dir === workdir) {
        return ['.env', '.env.local', '.env.example', 'src', '.git'];
      }
      if (dir === join(workdir, 'src')) {
        return ['.env.test', 'index.ts'];
      }
      return [];
    });

    mockStatSync.mockImplementation((path) => {
      const pathStr = path as string;
      if (pathStr.includes('.git') || pathStr.endsWith('src')) {
        return { isDirectory: () => true, isFile: () => false } as any;
      }
      return { isDirectory: () => false, isFile: () => true } as any;
    });

    // gitで追跡されていないファイルの判定
    mockExecSync.mockImplementation((command) => {
      const cmdStr = command as string;
      if (cmdStr.includes('git ls-files --error-unmatch')) {
        // .envファイルはgitで追跡されていない
        if (cmdStr.includes('.env') && !cmdStr.includes('index.ts')) {
          throw new Error('Not tracked');
        }
      }
      return '';
    });

    const result = getIgnoredFiles(workdir, patterns, excludePatterns);

    expect(result).toContain('.env');
    expect(result).toContain('.env.local');
    expect(result).toContain('src/.env.test');
    expect(result).not.toContain('.env.example'); // 除外パターン
    expect(result).not.toContain('src/index.ts'); // パターンに一致しない
  });

  // パターンに一致するファイルがない場合をテスト
  it('should return empty array when no files match patterns', () => {
    const workdir = '/Users/test/project';
    const patterns = ['.env'];

    mockReaddirSync.mockImplementation((dir) => {
      if (dir === workdir) {
        return ['src', 'package.json'];
      }
      return [];
    });

    mockStatSync.mockImplementation(() => ({
      isDirectory: () => false,
      isFile: () => true,
    }) as any);

    const result = getIgnoredFiles(workdir, patterns);
    expect(result).toEqual([]);
  });

  // ワイルドカードパターンのマッチングをテスト
  it('should handle wildcard patterns correctly', () => {
    const workdir = '/Users/test/project';
    const patterns = ['.env.*'];

    mockReaddirSync.mockImplementation((dir) => {
      if (dir === workdir) {
        return ['.env.local', '.env.production', '.envrc', 'env.txt'];
      }
      return [];
    });

    mockStatSync.mockImplementation(() => ({
      isDirectory: () => false,
      isFile: () => true,
    }) as any);

    mockExecSync.mockImplementation(() => {
      throw new Error('Not tracked');
    });

    const result = getIgnoredFiles(workdir, patterns);

    expect(result).toContain('.env.local');
    expect(result).toContain('.env.production');
    expect(result).not.toContain('.envrc'); // パターンに一致しない
    expect(result).not.toContain('env.txt'); // パターンに一致しない
  });
});

describe('copyFiles', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ファイルの正常なコピーをテスト
  it('should copy files successfully', () => {
    const sourceDir = '/Users/test/project';
    const targetDir = '/Users/test/git-worktrees/project/feature-1';
    const files = ['.env', 'config/.env.local'];

    mockExistsSync.mockImplementation((path) => {
      const pathStr = path as string;
      if (pathStr.includes(sourceDir)) {
        return true; // ソースファイルは存在
      }
      if (pathStr === join(targetDir, 'config')) {
        return false; // ターゲットディレクトリは存在しない
      }
      return true;
    });

    mockCopyFileSync.mockImplementation(() => {});
    mockMkdirSync.mockImplementation(() => undefined);

    const result = copyFiles(sourceDir, targetDir, files);

    expect(result).toEqual(['.env', 'config/.env.local']);
    expect(mockMkdirSync).toHaveBeenCalledWith(
      join(targetDir, 'config'),
      { recursive: true }
    );
    expect(mockCopyFileSync).toHaveBeenCalledWith(
      join(sourceDir, '.env'),
      join(targetDir, '.env')
    );
    expect(mockCopyFileSync).toHaveBeenCalledWith(
      join(sourceDir, 'config/.env.local'),
      join(targetDir, 'config/.env.local')
    );
  });

  // 存在しないソースファイルのスキップをテスト
  it('should skip non-existent source files', () => {
    const sourceDir = '/Users/test/project';
    const targetDir = '/Users/test/git-worktrees/project/feature-1';
    const files = ['.env', '.env.missing'];

    mockExistsSync.mockImplementation((path) => {
      const pathStr = path as string;
      if (pathStr === join(sourceDir, '.env')) {
        return true;
      }
      if (pathStr === join(sourceDir, '.env.missing')) {
        return false;
      }
      return true;
    });

    mockCopyFileSync.mockImplementation(() => {});

    const result = copyFiles(sourceDir, targetDir, files);

    expect(result).toEqual(['.env']);
    expect(mockCopyFileSync).toHaveBeenCalledTimes(1);
    expect(mockCopyFileSync).toHaveBeenCalledWith(
      join(sourceDir, '.env'),
      join(targetDir, '.env')
    );
  });

  // コピーエラーの処理をテスト
  it('should handle copy errors gracefully', () => {
    const sourceDir = '/Users/test/project';
    const targetDir = '/Users/test/git-worktrees/project/feature-1';
    const files = ['.env', '.env.readonly'];

    mockExistsSync.mockReturnValue(true);
    mockCopyFileSync.mockImplementation((src) => {
      if ((src as string).includes('.env.readonly')) {
        throw new Error('Permission denied');
      }
    });

    const result = copyFiles(sourceDir, targetDir, files);

    expect(result).toEqual(['.env']); // エラーが発生したファイルは除外
    expect(mockCopyFileSync).toHaveBeenCalledTimes(2);
  });

  // 空のファイルリストの処理をテスト
  it('should return empty array for empty file list', () => {
    const sourceDir = '/Users/test/project';
    const targetDir = '/Users/test/git-worktrees/project/feature-1';
    const files: string[] = [];

    const result = copyFiles(sourceDir, targetDir, files);

    expect(result).toEqual([]);
    expect(mockCopyFileSync).not.toHaveBeenCalled();
  });
});
