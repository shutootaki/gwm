import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { openWithEditor } from '../src/utils/editor.js';
import { execSync } from 'child_process';

// child_process.execSync をモック
vi.mock('child_process', () => ({
  execSync: vi.fn(),
  exec: vi.fn(),
}));

const mockExecSync = vi.mocked(execSync);

describe('openWithEditor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('成功ケース', () => {
    it('VS Codeが正常に起動される場合はtrueを返す', () => {
      mockExecSync.mockReturnValue(Buffer.from(''));

      const result = openWithEditor('/path/to/project', 'code');

      expect(result).toBe(true);
      expect(mockExecSync).toHaveBeenCalledWith("code '/path/to/project'", {
        cwd: process.cwd(),
        stdio: 'ignore',
      });
    });

    it('Cursorが正常に起動される場合はtrueを返す', () => {
      mockExecSync.mockReturnValue(Buffer.from(''));

      const result = openWithEditor('/path/to/project', 'cursor');

      expect(result).toBe(true);
      expect(mockExecSync).toHaveBeenCalledWith("cursor '/path/to/project'", {
        cwd: process.cwd(),
        stdio: 'ignore',
      });
    });
  });

  describe('失敗ケース', () => {
    it('VS Codeが見つからない場合はfalseを返す', () => {
      mockExecSync.mockImplementation(() => {
        throw new Error('Command not found: code');
      });

      const result = openWithEditor('/path/to/project', 'code');

      expect(result).toBe(false);
      expect(mockExecSync).toHaveBeenCalledWith("code '/path/to/project'", {
        cwd: process.cwd(),
        stdio: 'ignore',
      });
    });

    it('Cursorが見つからない場合はfalseを返す', () => {
      mockExecSync.mockImplementation(() => {
        throw new Error('Command not found: cursor');
      });

      const result = openWithEditor('/path/to/project', 'cursor');

      expect(result).toBe(false);
      expect(mockExecSync).toHaveBeenCalledWith("cursor '/path/to/project'", {
        cwd: process.cwd(),
        stdio: 'ignore',
      });
    });

    it('execSyncが他のエラーで失敗した場合もfalseを返す', () => {
      mockExecSync.mockImplementation(() => {
        throw new Error('Permission denied');
      });

      const result = openWithEditor('/path/to/project', 'code');

      expect(result).toBe(false);
    });
  });

  describe('パスのエスケープ処理', () => {
    it('スペースを含むパスが正しくエスケープされる', () => {
      mockExecSync.mockReturnValue(Buffer.from(''));

      const result = openWithEditor('/path/with spaces/project', 'code');

      expect(result).toBe(true);
      expect(mockExecSync).toHaveBeenCalledWith(
        "code '/path/with spaces/project'",
        {
          cwd: process.cwd(),
          stdio: 'ignore',
        }
      );
    });

    it('特殊文字を含むパスが正しくエスケープされる', () => {
      mockExecSync.mockReturnValue(Buffer.from(''));

      const result = openWithEditor('/path/with"quotes/project', 'code');

      expect(result).toBe(true);
      expect(mockExecSync).toHaveBeenCalledWith(
        "code '/path/with\"quotes/project'",
        {
          cwd: process.cwd(),
          stdio: 'ignore',
        }
      );
    });

    it('複数の特殊文字を含むパスが正しく処理される', () => {
      mockExecSync.mockReturnValue(Buffer.from(''));

      const result = openWithEditor(
        '/path/with spaces and "quotes"/project',
        'cursor'
      );

      expect(result).toBe(true);
      expect(mockExecSync).toHaveBeenCalledWith(
        'cursor \'/path/with spaces and "quotes"/project\'',
        {
          cwd: process.cwd(),
          stdio: 'ignore',
        }
      );
    });
  });

  describe('エッジケース', () => {
    it('空のパスでも正常に処理される', () => {
      mockExecSync.mockReturnValue(Buffer.from(''));

      const result = openWithEditor('', 'code');

      expect(result).toBe(true);
      expect(mockExecSync).toHaveBeenCalledWith("code ''", {
        cwd: process.cwd(),
        stdio: 'ignore',
      });
    });

    it('相対パスでも正常に処理される', () => {
      mockExecSync.mockReturnValue(Buffer.from(''));

      const result = openWithEditor('./relative/path', 'code');

      expect(result).toBe(true);
      expect(mockExecSync).toHaveBeenCalledWith("code './relative/path'", {
        cwd: process.cwd(),
        stdio: 'ignore',
      });
    });

    it('ホームディレクトリのパス（~）も正常に処理される', () => {
      mockExecSync.mockReturnValue(Buffer.from(''));

      const result = openWithEditor('~/Documents/project', 'cursor');

      expect(result).toBe(true);
      expect(mockExecSync).toHaveBeenCalledWith(
        "cursor '~/Documents/project'",
        {
          cwd: process.cwd(),
          stdio: 'ignore',
        }
      );
    });
  });
});
