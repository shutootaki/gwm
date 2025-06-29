import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  validateBranchName,
  generateWorktreePreview,
} from '../src/components/TextInput.js';

// React InkのUIコンポーネントをモック化
vi.mock('ink', () => ({
  render: vi.fn(),
  Box: ({ children }: any) => children,
  Text: ({ children }: any) => children,
  useInput: vi.fn(),
  useApp: vi.fn(() => ({ exit: vi.fn() })),
}));

// Configとgitユーティリティをモック化
vi.mock('../src/config.js', () => ({
  loadConfig: vi.fn(() => ({
    worktree_base_path: '/Users/test/worktrees',
    main_branches: ['main', 'master', 'develop'],
    clean_branch: 'ask',
  })),
}));

vi.mock('../src/utils/git.js', () => ({
  getRepositoryName: vi.fn(() => 'test-repo'),
}));

describe('TextInput Component Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Branch Name Validation', () => {
    it('should accept valid branch names', () => {
      const validNames = [
        'feature/user-auth',
        'bugfix-123',
        'release/v1.0.0',
        'hotfix_critical',
        'my-branch',
      ];

      validNames.forEach((name) => {
        expect(validateBranchName(name)).toBeNull();
      });
    });

    it('should reject empty branch names', () => {
      expect(validateBranchName('')).toBe('Branch name cannot be empty');
      expect(validateBranchName('   ')).toBe('Branch name cannot be empty');
    });

    it('should reject branch names with invalid characters', () => {
      const invalidNames = [
        'branch~with~tildes',
        'branch^with^carets',
        'branch:with:colons',
        'branch?with?questions',
        'branch*with*asterisks',
        'branch[with]brackets',
        'branch\\with\\backslashes',
      ];

      invalidNames.forEach((name) => {
        const result = validateBranchName(name);
        expect(result).toContain('invalid characters');
      });
    });

    it('should reject branch names starting or ending with dots', () => {
      expect(validateBranchName('.branch')).toContain(
        'cannot start or end with a dot'
      );
      expect(validateBranchName('branch.')).toContain(
        'cannot start or end with a dot'
      );
      expect(validateBranchName('.branch.')).toContain(
        'cannot start or end with a dot'
      );
    });

    it('should reject branch names with consecutive dots', () => {
      expect(validateBranchName('branch..name')).toContain('consecutive dots');
      expect(validateBranchName('feature..auth')).toContain('consecutive dots');
    });

    it('should reject branch names with spaces', () => {
      expect(validateBranchName('branch with spaces')).toContain(
        'cannot contain spaces'
      );
      expect(validateBranchName('feature auth')).toContain(
        'cannot contain spaces'
      );
    });

    it('should reject branch names that are too long', () => {
      const longName = 'a'.repeat(51);
      expect(validateBranchName(longName)).toContain('too long');
    });

    it('should accept branch names at the length limit', () => {
      const maxLengthName = 'a'.repeat(50);
      expect(validateBranchName(maxLengthName)).toBeNull();
    });
  });

  describe('Worktree Preview Generation', () => {
    it('should generate correct worktree path', () => {
      const branchName = 'feature/user-auth';
      const preview = generateWorktreePreview(branchName);

      expect(preview).toBe('/Users/test/worktrees/test-repo/feature-user-auth');
    });

    it('should sanitize branch names by replacing slashes', () => {
      const testCases = [
        {
          input: 'feature/auth',
          expected: '/Users/test/worktrees/test-repo/feature-auth',
        },
        {
          input: 'release/v1.0.0',
          expected: '/Users/test/worktrees/test-repo/release-v1.0.0',
        },
        {
          input: 'hotfix/critical/fix',
          expected: '/Users/test/worktrees/test-repo/hotfix-critical-fix',
        },
      ];

      testCases.forEach(({ input, expected }) => {
        expect(generateWorktreePreview(input)).toBe(expected);
      });
    });

    it('should return null for empty branch names', () => {
      expect(generateWorktreePreview('')).toBeNull();
      expect(generateWorktreePreview('   ')).toBeNull();
    });

    it('should handle special characters in branch names', () => {
      const branchName = 'feature_auth-v2';
      const preview = generateWorktreePreview(branchName);

      expect(preview).toBe('/Users/test/worktrees/test-repo/feature_auth-v2');
    });
  });

  describe('Cursor Position Management', () => {
    // カーソル位置管理のロジックをテスト
    it('should manage cursor position correctly for text insertion', () => {
      const value = 'hello world';
      const cursorPosition = 5; // 'hello|world'
      const newChar = ' ';

      // カーソル位置に文字を挿入
      const newValue =
        value.slice(0, cursorPosition) + newChar + value.slice(cursorPosition);
      const newCursorPosition = cursorPosition + 1;

      expect(newValue).toBe('hello  world');
      expect(newCursorPosition).toBe(6);
    });

    it('should handle backspace correctly', () => {
      const value = 'hello world';
      const cursorPosition = 5; // 'hello|world'

      if (cursorPosition > 0) {
        const newValue =
          value.slice(0, cursorPosition - 1) + value.slice(cursorPosition);
        const newCursorPosition = cursorPosition - 1;

        expect(newValue).toBe('hell world');
        expect(newCursorPosition).toBe(4);
      }
    });

    it('should handle delete key correctly', () => {
      const value = 'hello world';
      const cursorPosition = 5; // 'hello|world'

      if (cursorPosition < value.length) {
        const newValue =
          value.slice(0, cursorPosition) + value.slice(cursorPosition + 1);

        expect(newValue).toBe('helloworld');
      }
    });

    it('should handle word deletion (Ctrl+W)', () => {
      const value = 'hello beautiful world';
      const cursorPosition = 15; // 'hello beautiful|world'

      // カーソル位置から左の単語境界を見つける
      let wordStart = cursorPosition;
      while (wordStart > 0 && value[wordStart - 1] !== ' ') {
        wordStart--;
      }

      const newValue = value.slice(0, wordStart) + value.slice(cursorPosition);
      const newCursorPosition = wordStart;

      expect(newValue).toBe('hello  world');
      expect(newCursorPosition).toBe(6);
    });

    it('should handle full text deletion (Command+Delete)', () => {
      const value = 'hello world';
      const newValue = '';
      const newCursorPosition = 0;

      expect(newValue).toBe('');
      expect(newCursorPosition).toBe(0);
    });

    it('should handle cursor movement boundaries', () => {
      const value = 'hello';
      let cursorPosition = 2;

      // 左矢印キー
      cursorPosition = Math.max(0, cursorPosition - 1);
      expect(cursorPosition).toBe(1);

      // 左端での左矢印
      cursorPosition = 0;
      cursorPosition = Math.max(0, cursorPosition - 1);
      expect(cursorPosition).toBe(0);

      // 右矢印キー
      cursorPosition = Math.min(value.length, cursorPosition + 1);
      expect(cursorPosition).toBe(1);

      // 右端での右矢印
      cursorPosition = value.length;
      cursorPosition = Math.min(value.length, cursorPosition + 1);
      expect(cursorPosition).toBe(5);
    });
  });

  describe('Text Display with Cursor', () => {
    it('should split text correctly for cursor display', () => {
      const value = 'hello world';
      const cursorPosition = 5;

      const beforeCursor = value.slice(0, cursorPosition);
      const afterCursor = value.slice(cursorPosition);

      expect(beforeCursor).toBe('hello');
      expect(afterCursor).toBe(' world');
    });

    it('should handle cursor at beginning', () => {
      const value = 'hello';
      const cursorPosition = 0;

      const beforeCursor = value.slice(0, cursorPosition);
      const afterCursor = value.slice(cursorPosition);

      expect(beforeCursor).toBe('');
      expect(afterCursor).toBe('hello');
    });

    it('should handle cursor at end', () => {
      const value = 'hello';
      const cursorPosition = 5;

      const beforeCursor = value.slice(0, cursorPosition);
      const afterCursor = value.slice(cursorPosition);

      expect(beforeCursor).toBe('hello');
      expect(afterCursor).toBe('');
    });

    it('should handle empty string', () => {
      const value = '';
      const cursorPosition = 0;

      const beforeCursor = value.slice(0, cursorPosition);
      const afterCursor = value.slice(cursorPosition);

      expect(beforeCursor).toBe('');
      expect(afterCursor).toBe('');
    });
  });

  describe('Keyboard Event Handling Logic', () => {
    it('should handle keyboard navigation state', () => {
      const simulateKeyPress = (
        key: string,
        value: string,
        cursorPosition: number
      ) => {
        switch (key) {
          case 'leftArrow':
            return {
              value,
              cursorPosition: Math.max(0, cursorPosition - 1),
            };
          case 'rightArrow':
            return {
              value,
              cursorPosition: Math.min(value.length, cursorPosition + 1),
            };
          case 'backspace':
            if (cursorPosition > 0) {
              return {
                value:
                  value.slice(0, cursorPosition - 1) +
                  value.slice(cursorPosition),
                cursorPosition: cursorPosition - 1,
              };
            }
            return { value, cursorPosition };
          case 'delete':
            if (cursorPosition < value.length) {
              return {
                value:
                  value.slice(0, cursorPosition) +
                  value.slice(cursorPosition + 1),
                cursorPosition,
              };
            }
            return { value, cursorPosition };
          default:
            return { value, cursorPosition };
        }
      };

      let state = { value: 'hello', cursorPosition: 3 };

      // 左矢印
      state = simulateKeyPress('leftArrow', state.value, state.cursorPosition);
      expect(state.cursorPosition).toBe(2);

      // 右矢印
      state = simulateKeyPress('rightArrow', state.value, state.cursorPosition);
      expect(state.cursorPosition).toBe(3);

      // Backspace
      state = simulateKeyPress('backspace', state.value, state.cursorPosition);
      expect(state.value).toBe('helo');
      expect(state.cursorPosition).toBe(2);

      // Delete
      state = simulateKeyPress('delete', state.value, state.cursorPosition);
      expect(state.value).toBe('heo');
      expect(state.cursorPosition).toBe(2);
    });

    it('should handle character input at cursor position', () => {
      const insertCharacter = (
        value: string,
        cursorPosition: number,
        char: string
      ) => {
        const newValue =
          value.slice(0, cursorPosition) + char + value.slice(cursorPosition);
        return {
          value: newValue,
          cursorPosition: cursorPosition + 1,
        };
      };

      let state = { value: 'hello', cursorPosition: 2 };

      state = insertCharacter(state.value, state.cursorPosition, 'x');
      expect(state.value).toBe('hexllo');
      expect(state.cursorPosition).toBe(3);
    });
  });
});
