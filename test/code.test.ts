import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { openWithEditor } from '../src/utils/editor.js';
import { execSync } from 'child_process';

// child_process.execSync をモック
vi.mock('child_process', () => ({
  execSync: vi.fn(),
}));

const mockExecSync = vi.mocked(execSync);

describe('Code editor integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('VS Code integration', () => {
    it('VS Codeで現在のディレクトリを開く', () => {
      mockExecSync.mockReturnValue(Buffer.from(''));

      const result = openWithEditor('.', 'code');

      expect(result).toBe(true);
      expect(mockExecSync).toHaveBeenCalledWith("code '.'", {
        cwd: process.cwd(),
        stdio: 'ignore',
      });
    });

    it('VS Codeで特定のプロジェクトパスを開く', () => {
      mockExecSync.mockReturnValue(Buffer.from(''));

      const projectPath = '/Users/test/git-worktrees/project/feature-branch';
      const result = openWithEditor(projectPath, 'code');

      expect(result).toBe(true);
      expect(mockExecSync).toHaveBeenCalledWith(`code '${projectPath}'`, {
        cwd: process.cwd(),
        stdio: 'ignore',
      });
    });

    it('VS Codeがインストールされていない場合', () => {
      mockExecSync.mockImplementation(() => {
        throw new Error('command not found: code');
      });

      const result = openWithEditor('/path/to/project', 'code');

      expect(result).toBe(false);
    });
  });

  describe('Cursor integration', () => {
    it('Cursorで現在のディレクトリを開く', () => {
      mockExecSync.mockReturnValue(Buffer.from(''));

      const result = openWithEditor('.', 'cursor');

      expect(result).toBe(true);
      expect(mockExecSync).toHaveBeenCalledWith("cursor '.'", {
        cwd: process.cwd(),
        stdio: 'ignore',
      });
    });

    it('Cursorで特定のプロジェクトパスを開く', () => {
      mockExecSync.mockReturnValue(Buffer.from(''));

      const projectPath = '/Users/test/git-worktrees/project/main';
      const result = openWithEditor(projectPath, 'cursor');

      expect(result).toBe(true);
      expect(mockExecSync).toHaveBeenCalledWith(`cursor '${projectPath}'`, {
        cwd: process.cwd(),
        stdio: 'ignore',
      });
    });

    it('Cursorがインストールされていない場合', () => {
      mockExecSync.mockImplementation(() => {
        throw new Error('command not found: cursor');
      });

      const result = openWithEditor('/path/to/project', 'cursor');

      expect(result).toBe(false);
    });
  });

  describe('Worktree workflow integration', () => {
    it('新しいワークツリー作成後にVS Codeで開く', () => {
      mockExecSync.mockReturnValue(Buffer.from(''));

      const worktreePath = '/Users/test/git-worktrees/project/feature-new-ui';
      const result = openWithEditor(worktreePath, 'code');

      expect(result).toBe(true);
      expect(mockExecSync).toHaveBeenCalledWith(`code '${worktreePath}'`, {
        cwd: process.cwd(),
        stdio: 'ignore',
      });
    });

    it('既存のワークツリーをCursorで開く', () => {
      mockExecSync.mockReturnValue(Buffer.from(''));

      const worktreePath = '/Users/test/git-worktrees/project/bugfix-123';
      const result = openWithEditor(worktreePath, 'cursor');

      expect(result).toBe(true);
      expect(mockExecSync).toHaveBeenCalledWith(`cursor '${worktreePath}'`, {
        cwd: process.cwd(),
        stdio: 'ignore',
      });
    });

    it('複雑なパス名のワークツリーを開く', () => {
      mockExecSync.mockReturnValue(Buffer.from(''));

      const complexPath =
        '/Users/test/my projects/git-worktrees/project-name/feature/user-auth';
      const result = openWithEditor(complexPath, 'code');

      expect(result).toBe(true);
      expect(mockExecSync).toHaveBeenCalledWith(`code '${complexPath}'`, {
        cwd: process.cwd(),
        stdio: 'ignore',
      });
    });
  });

  describe('Error handling', () => {
    it('権限エラーの場合', () => {
      mockExecSync.mockImplementation(() => {
        throw new Error('Permission denied');
      });

      const result = openWithEditor('/restricted/path', 'code');

      expect(result).toBe(false);
    });

    it('存在しないパスの場合でもコマンド実行を試行する', () => {
      mockExecSync.mockReturnValue(Buffer.from(''));

      const nonExistentPath = '/non/existent/path';
      const result = openWithEditor(nonExistentPath, 'code');

      expect(result).toBe(true);
      expect(mockExecSync).toHaveBeenCalledWith(`code '${nonExistentPath}'`, {
        cwd: process.cwd(),
        stdio: 'ignore',
      });
    });

    it('ネットワークパスの場合', () => {
      mockExecSync.mockReturnValue(Buffer.from(''));

      const networkPath = '//server/share/project';
      const result = openWithEditor(networkPath, 'code');

      expect(result).toBe(true);
      expect(mockExecSync).toHaveBeenCalledWith(`code '${networkPath}'`, {
        cwd: process.cwd(),
        stdio: 'ignore',
      });
    });
  });

  describe('Platform compatibility', () => {
    it('Unix系パスの処理', () => {
      mockExecSync.mockReturnValue(Buffer.from(''));

      const unixPath = '/home/user/projects/my-app';
      const result = openWithEditor(unixPath, 'code');

      expect(result).toBe(true);
      expect(mockExecSync).toHaveBeenCalledWith(`code '${unixPath}'`, {
        cwd: process.cwd(),
        stdio: 'ignore',
      });
    });

    it('Windowsパスの処理', () => {
      mockExecSync.mockReturnValue(Buffer.from(''));

      const windowsPath = 'C:\\\\Users\\\\Name\\\\Projects\\\\app';
      const result = openWithEditor(windowsPath, 'code');

      expect(result).toBe(true);
      expect(mockExecSync).toHaveBeenCalledWith(`code '${windowsPath}'`, {
        cwd: process.cwd(),
        stdio: 'ignore',
      });
    });

    it('相対パスの処理', () => {
      mockExecSync.mockReturnValue(Buffer.from(''));

      const relativePath = '../other-project';
      const result = openWithEditor(relativePath, 'cursor');

      expect(result).toBe(true);
      expect(mockExecSync).toHaveBeenCalledWith(`cursor '${relativePath}'`, {
        cwd: process.cwd(),
        stdio: 'ignore',
      });
    });
  });

  describe('Command line behavior', () => {
    it('stdi設定がignoreになっている', () => {
      mockExecSync.mockReturnValue(Buffer.from(''));

      openWithEditor('/test/path', 'code');

      const callArgs = mockExecSync.mock.calls[0][1];
      expect(callArgs?.stdio).toBe('ignore');
    });

    it('cwdが現在のプロセスディレクトリになっている', () => {
      mockExecSync.mockReturnValue(Buffer.from(''));

      openWithEditor('/test/path', 'code');

      const callArgs = mockExecSync.mock.calls[0][1];
      expect(callArgs?.cwd).toBe(process.cwd());
    });

    it('コマンドが正しい形式で実行される', () => {
      mockExecSync.mockReturnValue(Buffer.from(''));

      openWithEditor('/test/path', 'code');

      const command = mockExecSync.mock.calls[0][0];
      expect(command).toBe("code '/test/path'");
    });
  });
});
