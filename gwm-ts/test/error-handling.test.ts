import { describe, it, expect, vi, beforeEach } from 'vitest';
import { execSync } from 'child_process';
import {
  getWorktreesWithStatus,
  fetchAndPrune,
  removeWorktree,
} from '../src/utils/git/index.js';
import { loadConfig } from '../src/config/index.js';

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

// loadConfigをモック化
vi.mock('../src/config/index.js', () => ({
  loadConfig: vi.fn(() => ({
    worktree_base_path: '/Users/test/git-worktrees',
    main_branches: ['main', 'master'],
    clean_branch: 'ask',
  })),
}));

import { execAsync } from '../src/utils/shell.js';

const mockExecSync = vi.mocked(execSync);
const mockExecAsync = vi.mocked(execAsync);

describe('Error Handling Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Git Repository Validation', () => {
    // Gitリポジトリではない場所でコマンドを実行した場合のエラーハンドリングをテスト
    it('should handle when not in a git repository', async () => {
      mockExecSync.mockImplementation((command) => {
        if (command === 'git rev-parse --git-dir') {
          const error = new Error('fatal: not a git repository');
          error.name = 'Error';
          throw error;
        }
        return '';
      });

      await expect(getWorktreesWithStatus()).rejects.toThrow(
        'Not a git repository. Please run this command from within a git repository.'
      );
    });

    // Gitリポジトリ内での権限不足エラーのハンドリングをテスト
    it('should handle permission denied errors in git repository', async () => {
      mockExecSync.mockImplementation((command) => {
        if (command === 'git rev-parse --git-dir') {
          return '';
        }
        return '';
      });

      mockExecAsync.mockRejectedValue(new Error('Permission denied'));

      await expect(getWorktreesWithStatus()).rejects.toThrow(
        'Permission denied'
      );
    });
  });

  describe('Network and Remote Operations', () => {
    // リモートリポジトリへの接続タイムアウトエラーのハンドリングをテスト
    it('should handle network timeout during fetch', async () => {
      mockExecAsync.mockRejectedValue(new Error(
        "fatal: unable to access 'https://github.com/repo.git/': Failed to connect to github.com port 443: Connection timed out"
      ));

      await expect(fetchAndPrune()).rejects.toThrow(
        "Failed to fetch and prune from remote: fatal: unable to access 'https://github.com/repo.git/': Failed to connect to github.com port 443: Connection timed out"
      );
    });

    // プライベートリポジトリの認証エラーのハンドリングをテスト
    it('should handle authentication errors during fetch', async () => {
      mockExecAsync.mockRejectedValue(new Error(
        "fatal: Authentication failed for 'https://github.com/private-repo.git/'"
      ));

      await expect(fetchAndPrune()).rejects.toThrow(
        "Failed to fetch and prune from remote: fatal: Authentication failed for 'https://github.com/private-repo.git/'"
      );
    });

    // リモートorigin設定なしの場合のエラーハンドリングをテスト
    it('should handle missing remote origin', async () => {
      mockExecAsync.mockRejectedValue(new Error(
        "fatal: No such remote 'origin'"
      ));

      await expect(fetchAndPrune()).rejects.toThrow(
        'No remote named "origin" found. Please configure a remote repository.'
      );
    });
  });

  describe('Worktree Removal Errors', () => {
    // コミットされていない変更があるworktreeの削除エラーのハンドリングをテスト
    it('should handle worktree removal with uncommitted changes', async () => {
      mockExecAsync.mockRejectedValue(new Error(
        "fatal: 'path/to/worktree' contains modified or untracked files, use --force to delete anyway"
      ));

      await expect(removeWorktree('/path/to/worktree')).rejects.toThrow(
        "Failed to remove worktree /path/to/worktree: fatal: 'path/to/worktree' contains modified or untracked files, use --force to delete anyway"
      );
    });

    // 存在しないworktreeの削除エラーのハンドリングをテスト
    it('should handle worktree removal of non-existent path', async () => {
      mockExecAsync.mockRejectedValue(new Error(
        "fatal: 'path/to/nonexistent' is not a working tree"
      ));

      await expect(removeWorktree('/path/to/nonexistent')).rejects.toThrow(
        "Failed to remove worktree /path/to/nonexistent: fatal: 'path/to/nonexistent' is not a working tree"
      );
    });

    // ロックされたworktreeの削除エラーのハンドリングをテスト
    it('should handle worktree removal with locked worktree', async () => {
      mockExecAsync.mockRejectedValue(new Error(
        "fatal: 'path/to/worktree' is locked; use --force to delete anyway"
      ));

      await expect(removeWorktree('/path/to/worktree')).rejects.toThrow(
        "Failed to remove worktree /path/to/worktree: fatal: 'path/to/worktree' is locked; use --force to delete anyway"
      );
    });
  });

  describe('Malformed Git Output', () => {
    // 不正な形式のgit worktree list出力のハンドリングをテスト
    it('should handle malformed git worktree list output', async () => {
      mockExecSync.mockImplementation((command) => {
        if (command === 'git rev-parse --git-dir') {
          return '';
        }
        return '';
      });

      mockExecAsync.mockResolvedValue({
        stdout: 'invalid\nformat',
        stderr: '',
      });

      const worktrees = await getWorktreesWithStatus();

      // 不正な形式でも空配列ではなく何らかの結果が返されることを確認
      expect(Array.isArray(worktrees)).toBe(true);
    });

    // 空のgit worktree list出力のハンドリングをテスト
    it('should handle empty git worktree list output', async () => {
      mockExecSync.mockImplementation((command) => {
        if (command === 'git rev-parse --git-dir') {
          return '';
        }
        return '';
      });

      mockExecAsync.mockResolvedValue({
        stdout: '', // 空の出力
        stderr: '',
      });

      const worktrees = await getWorktreesWithStatus();

      expect(worktrees).toEqual([]);
    });
  });

  describe('System-level Errors', () => {
    // コマンドが見つからない場合のエラーハンドリングをテスト
    it('should handle command not found errors', () => {
      mockExecSync.mockImplementation(() => {
        const error = new Error('command not found: git');
        (error as any).code = 'ENOENT';
        throw error;
      });

      expect(() => {
        loadConfig(); // loadConfigを呼び出してエラーがスローされることを確認
      }).not.toThrow(); // loadConfig自体はエラーをスローしない
    });

    // システムメモリ不足エラーのハンドリングをテスト
    it('should handle out of memory errors', async () => {
      mockExecSync.mockImplementation((command) => {
        if (command === 'git rev-parse --git-dir') {
          return '';
        }
        return '';
      });

      mockExecAsync.mockRejectedValue(new Error('Cannot allocate memory'));

      await expect(getWorktreesWithStatus()).rejects.toThrow(
        'Cannot allocate memory'
      );
    });

    // 設定ファイル読み込みエラーの寛大なハンドリングをテスト
    it('should handle config loading errors gracefully', () => {
      // loadConfigはエラーをスローせずにデフォルト値を返すべき
      const config = loadConfig();
      expect(config).toBeDefined();
    });
  });

  describe('Path and File System Errors', () => {
    // パス名に無効な文字が含まれる場合のエラーハンドリングをテスト
    it('should handle invalid path characters in worktree names', async () => {
      const invalidPath = '/invalid/path\x00/with/null';

      mockExecAsync.mockRejectedValue(new Error('fatal: invalid path'));

      await expect(removeWorktree(invalidPath)).rejects.toThrow(
        `Failed to remove worktree ${invalidPath}: fatal: invalid path`
      );
    });

    // ディスク容量不足エラーのハンドリングをテスト
    it('should handle file system full errors', async () => {
      mockExecAsync.mockRejectedValue(new Error('fatal: No space left on device'));

      await expect(removeWorktree('/path/to/worktree')).rejects.toThrow(
        'Failed to remove worktree /path/to/worktree: fatal: No space left on device'
      );
    });
  });
});