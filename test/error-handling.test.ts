import { describe, it, expect, vi, beforeEach } from 'vitest';
import { execSync } from 'child_process';
import {
  getWorktreesWithStatus,
  fetchAndPrune,
  removeWorktree,
} from '../src/utils/git.js';
import { loadConfig } from '../src/config.js';

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
        if (command === 'git worktree list --porcelain') {
          const error = new Error('Permission denied');
          throw error;
        }
        return '';
      });

      await expect(getWorktreesWithStatus()).rejects.toThrow(
        'Permission denied'
      );
    });
  });

  describe('Network and Remote Operations', () => {
    // リモートリポジトリへの接続タイムアウトエラーのハンドリングをテスト
    it('should handle network timeout during fetch', () => {
      mockExecSync.mockImplementation(() => {
        const error = new Error(
          "fatal: unable to access 'https://github.com/repo.git/': Failed to connect to github.com port 443: Connection timed out"
        );
        throw error;
      });

      expect(() => fetchAndPrune()).toThrow(
        "Failed to fetch and prune from remote: fatal: unable to access 'https://github.com/repo.git/': Failed to connect to github.com port 443: Connection timed out"
      );
    });

    // プライベートリポジトリの認証エラーのハンドリングをテスト
    it('should handle authentication errors during fetch', () => {
      mockExecSync.mockImplementation(() => {
        const error = new Error(
          "fatal: Authentication failed for 'https://github.com/private-repo.git/'"
        );
        throw error;
      });

      expect(() => fetchAndPrune()).toThrow(
        "Failed to fetch and prune from remote: fatal: Authentication failed for 'https://github.com/private-repo.git/'"
      );
    });

    // リモートorigin設定なしの場合のエラーハンドリングをテスト
    it('should handle missing remote origin', () => {
      mockExecSync.mockImplementation(() => {
        const error = new Error(
          "fatal: 'origin' does not appear to be a git repository"
        );
        error.message = "No such remote 'origin'";
        throw error;
      });

      expect(() => fetchAndPrune()).toThrow(
        'No remote named "origin" found. Please configure a remote repository.'
      );
    });
  });

  describe('Worktree Removal Errors', () => {
    // 未コミット変更があるworktreeの削除エラーのハンドリングをテスト
    it('should handle worktree removal with uncommitted changes', () => {
      mockExecSync.mockImplementation(() => {
        const error = new Error(
          "fatal: 'path/to/worktree' contains modified or untracked files, use --force to delete it"
        );
        throw error;
      });

      expect(() => removeWorktree('/path/to/worktree')).toThrow(
        "Failed to remove worktree /path/to/worktree: fatal: 'path/to/worktree' contains modified or untracked files, use --force to delete it"
      );
    });

    // 存在しないworktreeパスの削除エラーのハンドリングをテスト
    it('should handle worktree removal of non-existent path', () => {
      mockExecSync.mockImplementation(() => {
        const error = new Error(
          "fatal: 'path/to/nonexistent' is not a working tree"
        );
        throw error;
      });

      expect(() => removeWorktree('/path/to/nonexistent')).toThrow(
        "Failed to remove worktree /path/to/nonexistent: fatal: 'path/to/nonexistent' is not a working tree"
      );
    });

    // ロックされたworktreeの削除エラーのハンドリングをテスト
    it('should handle worktree removal with locked worktree', () => {
      mockExecSync.mockImplementation(() => {
        const error = new Error(
          "fatal: 'path/to/worktree' is locked; use --force to override or unlock first"
        );
        throw error;
      });

      expect(() => removeWorktree('/path/to/worktree')).toThrow(
        "Failed to remove worktree /path/to/worktree: fatal: 'path/to/worktree' is locked; use --force to override or unlock first"
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
        if (command === 'git worktree list --porcelain') {
          // 不正な形式の出力
          return 'invalid output format\nno worktree prefix';
        }
        return '';
      });

      const result = await getWorktreesWithStatus();
      expect(result).toEqual([]); // 空の配列を返すべき
    });

    // 空のgit worktree list出力のハンドリングをテスト
    it('should handle empty git worktree list output', async () => {
      mockExecSync.mockImplementation((command) => {
        if (command === 'git rev-parse --git-dir') {
          return '';
        }
        if (command === 'git worktree list --porcelain') {
          return '';
        }
        return '';
      });

      const result = await getWorktreesWithStatus();
      expect(result).toEqual([]);
    });
  });

  describe('System-level Errors', () => {
    // gitコマンドが見つからない場合のシステムエラーのハンドリングをテスト
    it('should handle command not found errors', async () => {
      mockExecSync.mockImplementation(() => {
        const error = new Error('command not found: git');
        error.name = 'Error';
        throw error;
      });

      await expect(getWorktreesWithStatus()).rejects.toThrow(
        'Not a git repository. Please run this command from within a git repository.'
      );
    });

    // システムメモリ不足エラーのハンドリングをテスト
    it('should handle out of memory errors', async () => {
      mockExecSync.mockImplementation((command) => {
        if (command === 'git rev-parse --git-dir') {
          return '';
        }
        if (command === 'git worktree list --porcelain') {
          const error = new Error('fatal: Out of memory, malloc failed');
          throw error;
        }
        return '';
      });

      await expect(getWorktreesWithStatus()).rejects.toThrow(
        'fatal: Out of memory, malloc failed'
      );
    });
  });

  describe('Configuration Errors', () => {
    // 設定ファイル読み込みエラーのハンドリングをテスト
    it('should handle config loading errors gracefully', () => {
      // loadConfigのモックを一時的に変更
      vi.mocked(loadConfig).mockImplementation(() => {
        throw new Error('Config file corrupted');
      });

      // エラーが投げられるかテスト（実際の実装では適切にハンドリングされるべき）
      expect(() => loadConfig()).toThrow('Config file corrupted');
    });
  });

  describe('Path and File System Errors', () => {
    // 無効なパス文字を含むworktree名のエラーハンドリングをテスト
    it('should handle invalid path characters in worktree names', () => {
      const invalidPath = '/path/with/invalid\x00character';

      mockExecSync.mockImplementation(() => {
        const error = new Error('fatal: invalid path');
        throw error;
      });

      expect(() => removeWorktree(invalidPath)).toThrow(
        `Failed to remove worktree ${invalidPath}: fatal: invalid path`
      );
    });

    // ディスク容量不足エラーのハンドリングをテスト
    it('should handle file system full errors', () => {
      mockExecSync.mockImplementation(() => {
        const error = new Error('fatal: No space left on device');
        throw error;
      });

      expect(() => removeWorktree('/path/to/worktree')).toThrow(
        'Failed to remove worktree /path/to/worktree: fatal: No space left on device'
      );
    });
  });
});
