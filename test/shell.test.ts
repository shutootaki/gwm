import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { escapeShellArg, exec } from '../src/utils/shell.js';
import { execSync } from 'child_process';

// child_process.execSync をモック
vi.mock('child_process', () => ({
  execSync: vi.fn(),
}));

const mockExecSync = vi.mocked(execSync);

describe('shell utilities', () => {
  describe('escapeShellArg', () => {
    describe('基本的なエスケープ処理', () => {
      it('通常の文字列をダブルクォートで囲む', () => {
        const result = escapeShellArg('hello');
        expect(result).toBe('"hello"');
      });

      it('スペースを含む文字列をダブルクォートで囲む', () => {
        const result = escapeShellArg('hello world');
        expect(result).toBe('"hello world"');
      });

      it('空文字列をダブルクォートで囲む', () => {
        const result = escapeShellArg('');
        expect(result).toBe('""');
      });
    });

    describe('特殊文字のエスケープ', () => {
      it('ダブルクォートをエスケープする', () => {
        const result = escapeShellArg('hello "world"');
        expect(result).toBe('"hello \\"world\\""');
      });

      it('複数のダブルクォートをエスケープする', () => {
        const result = escapeShellArg('"test" and "more"');
        expect(result).toBe('"\\"test\\" and \\"more\\""');
      });

      it('文字列の先頭と末尾のダブルクォートをエスケープする', () => {
        const result = escapeShellArg('"wrapped"');
        expect(result).toBe('"\\"wrapped\\""');
      });
    });

    describe('エッジケース', () => {
      it('ダブルクォートのみの文字列', () => {
        const result = escapeShellArg('"');
        expect(result).toBe('"\\"\"');
      });

      it('連続するダブルクォート', () => {
        const result = escapeShellArg('""');
        expect(result).toBe('"\\"\\""');
      });

      it('バックスラッシュとダブルクォートの組み合わせ', () => {
        const result = escapeShellArg('path\\to\\"file');
        expect(result).toBe('"path\\to\\\\"file"');
      });
    });

    describe('パスとファイル名のテスト', () => {
      it('Unixパスをエスケープする', () => {
        const result = escapeShellArg('/home/user/project');
        expect(result).toBe('"/home/user/project"');
      });

      it('スペースを含むパスをエスケープする', () => {
        const result = escapeShellArg('/path/with spaces/file.txt');
        expect(result).toBe('"/path/with spaces/file.txt"');
      });

      it('ダブルクォートを含むファイル名をエスケープする', () => {
        const result = escapeShellArg('file "name".txt');
        expect(result).toBe('"file \\"name\\".txt"');
      });

      it('Windowsパスをエスケープする', () => {
        const result = escapeShellArg('C:\\\\Program Files\\\\App');
        expect(result).toBe('"C:\\\\Program Files\\\\App"');
      });
    });

    describe('Unicode文字とその他の特殊文字', () => {
      it('日本語文字列をエスケープする', () => {
        const result = escapeShellArg('こんにちは世界');
        expect(result).toBe('"こんにちは世界"');
      });

      it('絵文字を含む文字列をエスケープする', () => {
        const result = escapeShellArg('Hello 🌍 World');
        expect(result).toBe('"Hello 🌍 World"');
      });

      it('タブや改行を含む文字列をエスケープする', () => {
        const result = escapeShellArg('line1\\nline2\\tindented');
        expect(result).toBe('"line1\\nline2\\tindented"');
      });
    });
  });

  describe('exec', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    describe('基本的なコマンド実行', () => {
      it('デフォルトオプションでコマンドを実行する', () => {
        const mockResult = Buffer.from('command output');
        mockExecSync.mockReturnValue(mockResult);

        const result = exec('ls -la');

        expect(result).toBe(mockResult);
        expect(mockExecSync).toHaveBeenCalledWith('ls -la', {
          cwd: process.cwd(),
          stdio: 'inherit',
        });
      });

      it('カスタムオプションでコマンドを実行する', () => {
        const mockResult = Buffer.from('git status');
        mockExecSync.mockReturnValue(mockResult);

        const customOptions = {
          cwd: '/custom/path',
          stdio: 'pipe' as const,
          encoding: 'utf8' as const,
        };

        const result = exec('git status', customOptions);

        expect(result).toBe(mockResult);
        expect(mockExecSync).toHaveBeenCalledWith('git status', {
          cwd: '/custom/path',
          stdio: 'pipe',
          encoding: 'utf8',
        });
      });
    });

    describe('オプションの上書き', () => {
      it('デフォルトのcwdを上書きできる', () => {
        const mockResult = Buffer.from('output');
        mockExecSync.mockReturnValue(mockResult);

        exec('pwd', { cwd: '/tmp' });

        expect(mockExecSync).toHaveBeenCalledWith('pwd', {
          cwd: '/tmp',
          stdio: 'inherit',
        });
      });

      it('デフォルトのstdioを上書きできる', () => {
        const mockResult = Buffer.from('output');
        mockExecSync.mockReturnValue(mockResult);

        exec('echo test', { stdio: 'pipe' });

        expect(mockExecSync).toHaveBeenCalledWith('echo test', {
          cwd: process.cwd(),
          stdio: 'pipe',
        });
      });

      it('追加のオプションを設定できる', () => {
        const mockResult = Buffer.from('output');
        mockExecSync.mockReturnValue(mockResult);

        exec('node --version', { 
          timeout: 5000,
          env: { NODE_ENV: 'test' }
        });

        expect(mockExecSync).toHaveBeenCalledWith('node --version', {
          cwd: process.cwd(),
          stdio: 'inherit',
          timeout: 5000,
          env: { NODE_ENV: 'test' }
        });
      });
    });

    describe('エラーハンドリング', () => {
      it('execSyncのエラーをそのまま投げる', () => {
        const error = new Error('Command failed');
        mockExecSync.mockImplementation(() => {
          throw error;
        });

        expect(() => exec('invalid-command')).toThrow('Command failed');
        expect(mockExecSync).toHaveBeenCalledWith('invalid-command', {
          cwd: process.cwd(),
          stdio: 'inherit',
        });
      });
    });

    describe('実際のユースケース', () => {
      it('Gitコマンドの実行をシミュレート', () => {
        const mockResult = Buffer.from('main\\nfeature\\n');
        mockExecSync.mockReturnValue(mockResult);

        const result = exec('git branch', { 
          stdio: 'pipe',
          encoding: 'utf8'
        });

        expect(result).toBe(mockResult);
        expect(mockExecSync).toHaveBeenCalledWith('git branch', {
          cwd: process.cwd(),
          stdio: 'pipe',
          encoding: 'utf8',
        });
      });

      it('npm/pnpmコマンドの実行をシミュレート', () => {
        const mockResult = Buffer.from('Dependencies installed');
        mockExecSync.mockReturnValue(mockResult);

        const result = exec('pnpm install', {
          cwd: '/project/path',
          stdio: 'inherit'
        });

        expect(result).toBe(mockResult);
        expect(mockExecSync).toHaveBeenCalledWith('pnpm install', {
          cwd: '/project/path',
          stdio: 'inherit',
        });
      });
    });
  });
});