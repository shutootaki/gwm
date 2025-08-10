import { describe, it, expect, vi, beforeEach } from 'vitest';
import { execSync } from 'child_process';
import {
  existsSync,
  mkdirSync,
  readdirSync,
  statSync,
  lstatSync,
  type Stats,
} from 'fs';
import {
  lstat as lstatAsync,
  copyFile as copyFileAsync,
  mkdir as mkdirAsync,
  readlink as readlinkAsync,
  symlink as symlinkAsync,
  realpath as realpathAsync,
} from 'fs/promises';
import { join } from 'path';
import {
  parseWorktrees,
  getWorktreesWithStatus,
  fetchAndPrune,
  removeWorktree,
  getMainWorktreePath,
  getIgnoredFiles,
  copyFiles,
} from '../src/utils/git/index.js';
import { isVirtualEnv } from '../src/utils/virtualenv.js';

// execSyncをモック化
vi.mock('child_process', () => ({
  execSync: vi.fn(),
  exec: vi.fn(),
}));

// shell.jsをモック化
vi.mock('../src/utils/shell.js', () => ({
  execAsync: vi.fn(),
  escapeShellArg: vi.fn((arg) => `'${arg}'`),
}));

// fsモジュールをモック化
vi.mock('fs', () => ({
  existsSync: vi.fn(),
  mkdirSync: vi.fn(),
  readdirSync: vi.fn(),
  statSync: vi.fn(),
  lstatSync: vi.fn(),
  readlinkSync: vi.fn(),
  symlinkSync: vi.fn(),
}));

// fs/promises モジュールをモック化 (非同期API)
vi.mock('fs/promises', () => ({
  copyFile: vi.fn(),
  mkdir: vi.fn(),
  lstat: vi.fn(),
  readlink: vi.fn(),
  symlink: vi.fn(),
  realpath: vi.fn(async (p: string) => p),
}));

// virtualenvモジュールをモック化
vi.mock('../src/utils/virtualenv.js', () => ({
  isVirtualEnv: vi.fn(),
}));

// loadConfigをモック化
vi.mock('../src/config/index.js', () => ({
  loadConfig: vi.fn(() => ({
    worktree_base_path: '/Users/test/git-worktrees',
    main_branches: ['main', 'master'],
    clean_branch: 'ask',
    virtual_env_handling: {
      isolate_virtual_envs: true,
    },
  })),
}));

import { execAsync } from '../src/utils/shell.js';

const mockExecSync = vi.mocked(execSync);
const mockExecAsync = vi.mocked(execAsync);
const mockExistsSync = vi.mocked(existsSync);
const mockMkdirSync = vi.mocked(mkdirSync);
const mockReaddirSync = vi.mocked(readdirSync);
const mockStatSync = vi.mocked(statSync);
const mockLstatSync = vi.mocked(lstatSync);
const mockIsVirtualEnv = vi.mocked(isVirtualEnv);

// 非同期APIのモック
const mockLstatAsync = vi.mocked(lstatAsync as any);
const _mockCopyFileAsync = vi.mocked(copyFileAsync as any);
const _mockMkdirAsync = vi.mocked(mkdirAsync as any);
const _mockReadlinkAsync = vi.mocked(readlinkAsync as any);
const _mockSymlinkAsync = vi.mocked(symlinkAsync as any);
const mockRealpathAsync = vi.mocked(realpathAsync as any);

describe('parseWorktrees', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // 非同期APIのデフォルトモック挙動
    mockLstatAsync.mockResolvedValue({
      isSymbolicLink: () => false,
      size: 0,
    } as any);
    _mockCopyFileAsync.mockResolvedValue(undefined);
    _mockMkdirAsync.mockResolvedValue(undefined);
    _mockReadlinkAsync.mockResolvedValue('');
    _mockSymlinkAsync.mockResolvedValue(undefined);
    mockRealpathAsync.mockImplementation(async (p: string) => p);
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
      return '';
    });

    mockExecAsync.mockResolvedValue({
      stdout: porcelainOutput,
      stderr: '',
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
  it('should execute git fetch --prune origin successfully', async () => {
    mockExecAsync.mockResolvedValue({
      stdout: '',
      stderr: '',
    });

    await expect(fetchAndPrune()).resolves.not.toThrow();
    expect(mockExecAsync).toHaveBeenCalledWith('git fetch --prune origin', {
      cwd: process.cwd(),
    });
  });

  // リモートoriginが存在しない場合のエラーハンドリングをテスト
  it('should throw error when no remote origin exists', async () => {
    mockExecAsync.mockRejectedValue(new Error("No such remote 'origin'"));

    await expect(fetchAndPrune()).rejects.toThrow(
      'No remote named "origin" found. Please configure a remote repository.'
    );
  });

  // その他のエラーの汎用エラーハンドリングをテスト
  it('should throw generic error for other failures', async () => {
    mockExecAsync.mockRejectedValue(new Error('Network error'));

    await expect(fetchAndPrune()).rejects.toThrow(
      'Failed to fetch and prune from remote: Network error'
    );
  });
});

describe('removeWorktree', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // worktreeの正常な削除をテスト
  it('should remove worktree successfully', async () => {
    mockExecAsync.mockResolvedValue({
      stdout: '',
      stderr: '',
    });

    await expect(removeWorktree('/path/to/worktree')).resolves.not.toThrow();
    expect(mockExecAsync).toHaveBeenCalledWith(
      "git worktree remove '/path/to/worktree'",
      { cwd: process.cwd() }
    );
  });

  // --forceフラグ付きworktree削除をテスト
  it('should remove worktree with force flag', async () => {
    mockExecAsync.mockResolvedValue({
      stdout: '',
      stderr: '',
    });

    await expect(
      removeWorktree('/path/to/worktree', true)
    ).resolves.not.toThrow();
    expect(mockExecAsync).toHaveBeenCalledWith(
      "git worktree remove '/path/to/worktree' --force",
      { cwd: process.cwd() }
    );
  });

  // worktree削除失敗時のエラーハンドリングをテスト
  it('should throw error when removal fails', async () => {
    mockExecAsync.mockRejectedValue(
      new Error('worktree has uncommitted changes')
    );

    await expect(removeWorktree('/path/to/worktree')).rejects.toThrow(
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
        return [
          '.env',
          '.env.local',
          '.env.example',
          'src',
          '.git',
        ] as unknown as any;
      }
      if (dir === join(workdir, 'src')) {
        return ['.env.test', 'index.ts'] as unknown as any;
      }
      return [] as unknown as any;
    });

    mockStatSync.mockImplementation((path) => {
      const pathStr = path as string;
      if (pathStr.includes('.git') || pathStr.endsWith('src')) {
        return {
          isDirectory: () => true,
          isFile: () => false,
        } as unknown as Stats;
      }
      return {
        isDirectory: () => false,
        isFile: () => true,
      } as unknown as Stats;
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
        return ['src', 'package.json'] as unknown as any;
      }
      return [] as unknown as any;
    });

    mockStatSync.mockImplementation(
      () =>
        ({
          isDirectory: () => false,
          isFile: () => true,
        }) as unknown as Stats
    );

    const result = getIgnoredFiles(workdir, patterns);
    expect(result).toEqual([]);
  });

  // ワイルドカードパターンのマッチングをテスト
  it('should handle wildcard patterns correctly', () => {
    const workdir = '/Users/test/project';
    const patterns = ['.env.*'];

    mockReaddirSync.mockImplementation((dir) => {
      if (dir === workdir) {
        return [
          '.env.local',
          '.env.production',
          '.envrc',
          'env.txt',
        ] as unknown as any;
      }
      return [] as unknown as any;
    });

    mockStatSync.mockImplementation(
      () =>
        ({
          isDirectory: () => false,
          isFile: () => true,
        }) as unknown as Stats
    );

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
  it('should copy files successfully', async () => {
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

    _mockCopyFileAsync.mockResolvedValue(undefined);
    mockMkdirSync.mockImplementation(() => undefined);
    mockIsVirtualEnv.mockReturnValue(false);
    const statObj = { isSymbolicLink: () => false, size: 0 } as any;
    mockLstatSync.mockReturnValue(statObj);
    mockLstatAsync.mockResolvedValue(statObj);

    const result = await copyFiles(sourceDir, targetDir, files);

    expect(result.copied).toEqual(['.env', 'config/.env.local']);
    expect(_mockMkdirAsync).toHaveBeenCalledWith(join(targetDir, 'config'), {
      recursive: true,
    });
    expect(_mockCopyFileAsync).toHaveBeenCalledWith(
      join(sourceDir, '.env'),
      join(targetDir, '.env')
    );
    expect(_mockCopyFileAsync).toHaveBeenCalledWith(
      join(sourceDir, 'config/.env.local'),
      join(targetDir, 'config/.env.local')
    );
  });

  // 存在しないソースファイルのスキップをテスト
  it('should skip non-existent source files', async () => {
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

    _mockCopyFileAsync.mockResolvedValue(undefined);
    mockIsVirtualEnv.mockReturnValue(false);
    const statObj2 = { isSymbolicLink: () => false, size: 0 } as any;
    mockLstatSync.mockReturnValue(statObj2);
    mockLstatAsync.mockResolvedValue(statObj2);

    const result = await copyFiles(sourceDir, targetDir, files);

    expect(result.copied).toEqual(['.env']);
    expect(_mockCopyFileAsync).toHaveBeenCalledTimes(1);
    expect(_mockCopyFileAsync).toHaveBeenCalledWith(
      join(sourceDir, '.env'),
      join(targetDir, '.env')
    );
  });

  // コピーエラーの処理をテスト
  it('should handle copy errors gracefully', async () => {
    const sourceDir = '/Users/test/project';
    const targetDir = '/Users/test/git-worktrees/project/feature-1';
    const files = ['.env', '.env.readonly'];

    mockExistsSync.mockReturnValue(true);
    _mockCopyFileAsync.mockImplementation(async (src: string) => {
      if ((src as string).includes('.env.readonly')) {
        throw new Error('Permission denied');
      }
    });
    mockIsVirtualEnv.mockReturnValue(false);
    const linkStatObj = { isSymbolicLink: () => false, size: 0 } as any;
    mockLstatSync.mockReturnValue(linkStatObj);
    mockLstatAsync.mockResolvedValue(linkStatObj);

    const result = await copyFiles(sourceDir, targetDir, files);

    expect(result.copied).toEqual(['.env']); // エラーが発生したファイルは除外
    expect(_mockCopyFileAsync).toHaveBeenCalledTimes(2);
  });

  // 空のファイルリストの処理をテスト
  it('should return empty array for empty file list', async () => {
    const sourceDir = '/Users/test/project';
    const targetDir = '/Users/test/git-worktrees/project/feature-1';
    const files: string[] = [];

    const result = await copyFiles(sourceDir, targetDir, files);

    expect(result.copied).toEqual([]);
    expect(_mockCopyFileAsync).not.toHaveBeenCalled();
  });

  it('should skip virtual environment directories', async () => {
    const sourceDir = '/source';
    const targetDir = '/target';
    const files = ['.env', '.venv', 'node_modules', 'config.json'];

    mockExistsSync.mockReturnValue(true);
    mockIsVirtualEnv.mockImplementation((p: any) => {
      const path = p as string;
      return path === '.venv' || path === 'node_modules';
    });
    const linkStatObj2 = { isSymbolicLink: () => false, size: 0 } as any;
    mockLstatSync.mockReturnValue(linkStatObj2);
    mockLstatAsync.mockResolvedValue(linkStatObj2);

    const result = await copyFiles(sourceDir, targetDir, files);

    expect(result.copied).toEqual(['.env', 'config.json']);
    expect(_mockCopyFileAsync).toHaveBeenCalledTimes(2);
    expect(_mockCopyFileAsync).toHaveBeenCalledWith(
      join(sourceDir, '.env'),
      join(targetDir, '.env')
    );
    expect(_mockCopyFileAsync).toHaveBeenCalledWith(
      join(sourceDir, 'config.json'),
      join(targetDir, 'config.json')
    );

    // 仮想環境がスキップされたことを確認
    expect(result.skippedVirtualEnvs).toEqual(['.venv', 'node_modules']);
  });

  it('should handle symbolic links pointing within source directory', async () => {
    const sourceDir = '/source';
    const targetDir = '/target';
    const files = ['link-to-file'];

    mockExistsSync.mockReturnValue(true);
    mockIsVirtualEnv.mockReturnValue(false);
    const linkStatObj = { isSymbolicLink: () => true, size: 0 } as any;
    mockLstatSync.mockReturnValue(linkStatObj);
    mockLstatAsync.mockResolvedValue(linkStatObj);
    _mockReadlinkAsync.mockResolvedValue('../source/actual-file');

    const result = await copyFiles(sourceDir, targetDir, files);

    expect(result.copied).toEqual(['link-to-file']);
    expect(_mockSymlinkAsync).toHaveBeenCalled();
    // シンボリックリンクが新しいワークツリー内を指すように調整されることを確認
    const symlinkCall = _mockSymlinkAsync.mock.calls[0];
    expect(symlinkCall[1]).toBe(join(targetDir, 'link-to-file'));
  });

  it('should preserve external symbolic links', async () => {
    const sourceDir = '/source';
    const targetDir = '/target';
    const files = ['link-to-external'];

    mockExistsSync.mockReturnValue(true);
    mockIsVirtualEnv.mockReturnValue(false);
    const linkStatObj2 = { isSymbolicLink: () => true, size: 0 } as any;
    mockLstatSync.mockReturnValue(linkStatObj2);
    mockLstatAsync.mockResolvedValue(linkStatObj2);
    _mockReadlinkAsync.mockResolvedValue('/usr/local/bin/something');

    const result = await copyFiles(sourceDir, targetDir, files);

    expect(result.copied).toEqual(['link-to-external']);
    expect(_mockSymlinkAsync).toHaveBeenCalledWith(
      '/usr/local/bin/something',
      join(targetDir, 'link-to-external')
    );
  });

  it('should handle mixed files, virtual envs, and symlinks', async () => {
    const sourceDir = '/source';
    const targetDir = '/target';
    const files = ['.env', '.venv', 'symlink', 'regular.txt'];

    mockExistsSync.mockReturnValue(true);
    mockIsVirtualEnv.mockImplementation((path: any) => path === '.venv');
    mockLstatSync.mockImplementation(
      (p: any) =>
        ({
          isSymbolicLink: () => (p as string).includes('symlink'),
          size: 0,
        }) as any
    );
    mockLstatAsync.mockImplementation(
      async (p: any) =>
        ({
          isSymbolicLink: () => (p as string).includes('symlink'),
          size: 0,
        }) as any
    );
    _mockReadlinkAsync.mockResolvedValue('./regular.txt');

    const result = await copyFiles(sourceDir, targetDir, files);

    expect(result.copied).toEqual(['.env', 'symlink', 'regular.txt']);
    expect(_mockCopyFileAsync).toHaveBeenCalledTimes(2); // .env と regular.txt
    expect(_mockSymlinkAsync).toHaveBeenCalledTimes(1); // symlink
    expect(result.skippedVirtualEnvs).toEqual(['.venv']);
  });
});
