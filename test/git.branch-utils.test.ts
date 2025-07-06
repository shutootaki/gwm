import { describe, it, expect, vi, beforeEach } from 'vitest';

// child_process の execSync をモック化
vi.mock('child_process', () => ({
  execSync: vi.fn(),
}));

import { execSync } from 'child_process';
import {
  localBranchExists,
  hasUnmergedCommits,
  deleteLocalBranch,
} from '../src/utils/git/index.js';

const mockExecSync = vi.mocked(execSync);

describe('git branch helper utilities', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('localBranchExists', () => {
    it('should return true when git show-ref succeeds', () => {
      mockExecSync.mockReturnValueOnce('');

      const result = localBranchExists('feature/test');

      expect(result).toBe(true);
      expect(mockExecSync).toHaveBeenCalledWith(
        "git show-ref --verify --quiet refs/heads/'feature/test'",
        {
          stdio: 'ignore',
          cwd: process.cwd(),
        }
      );
    });

    it('should return false when git show-ref throws', () => {
      mockExecSync.mockImplementationOnce(() => {
        throw new Error('not found');
      });

      const result = localBranchExists('feature/test');

      expect(result).toBe(false);
    });
  });

  describe('hasUnmergedCommits', () => {
    it('should return false when upstream remote does not exist', () => {
      // 1回目 show-ref (remote check) で失敗させる
      mockExecSync.mockImplementation(() => {
        throw new Error('reference not found');
      });

      const result = hasUnmergedCommits('feature/test');

      expect(result).toBe(false);
      expect(mockExecSync).toHaveBeenCalledTimes(1);
    });

    it('should return false when no commits are pending', () => {
      mockExecSync.mockImplementation((command: string) => {
        if (command.startsWith('git show-ref')) {
          return '';
        }
        if (command.startsWith('git cherry')) {
          return '';
        }
        return '';
      });

      const result = hasUnmergedCommits('feature/test');

      expect(result).toBe(false);
    });

    it('should return true when unmerged commits exist', () => {
      mockExecSync.mockImplementation((command: string) => {
        if (command.startsWith('git show-ref')) {
          return '';
        }
        if (command.startsWith('git cherry')) {
          return '+ abc123 commit message';
        }
        return '';
      });

      const result = hasUnmergedCommits('feature/test');

      expect(result).toBe(true);
    });

    it('should return true when git cherry throws error', () => {
      mockExecSync.mockImplementation((command: string) => {
        if (command.startsWith('git show-ref')) {
          return '';
        }
        if (command.startsWith('git cherry')) {
          throw new Error('git error');
        }
        return '';
      });

      const result = hasUnmergedCommits('feature/test');

      expect(result).toBe(true);
    });
  });

  describe('deleteLocalBranch', () => {
    it('should call git branch -d when force is false', () => {
      mockExecSync.mockReturnValueOnce('');

      deleteLocalBranch('feature/test', false);

      expect(mockExecSync).toHaveBeenCalledWith(
        "git branch -d 'feature/test'",
        {
          stdio: 'ignore',
          cwd: process.cwd(),
        }
      );
    });

    it('should call git branch -D when force is true', () => {
      mockExecSync.mockReturnValueOnce('');

      deleteLocalBranch('feature/test', true);

      expect(mockExecSync).toHaveBeenCalledWith(
        "git branch -D 'feature/test'",
        {
          stdio: 'ignore',
          cwd: process.cwd(),
        }
      );
    });

    it('should throw wrapped error when git command fails', () => {
      mockExecSync.mockImplementationOnce(() => {
        throw new Error('permission denied');
      });

      expect(() => deleteLocalBranch('feature/test', false)).toThrow(
        /Failed to delete branch/
      );
    });
  });
});
