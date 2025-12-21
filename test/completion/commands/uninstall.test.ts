/**
 * uninstall.ts のテスト
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  parseUninstallArgs,
  runUninstall,
} from '../../../src/completion/commands/uninstall.js';

// fs をモック
vi.mock('fs', () => ({
  existsSync: vi.fn(),
  unlinkSync: vi.fn(),
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
}));

// os をモック
vi.mock('os', () => ({
  homedir: vi.fn().mockReturnValue('/mock/home'),
}));

import { existsSync, unlinkSync, readFileSync } from 'fs';

describe('uninstall', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('parseUninstallArgs', () => {
    it('--shell オプションをパースする', () => {
      const result = parseUninstallArgs(['--shell', 'zsh']);
      expect(result).toEqual({ shell: 'zsh' });
    });

    it('--kiro オプションをパースする', () => {
      const result = parseUninstallArgs(['--kiro']);
      expect(result).toEqual({ kiro: true });
    });

    it('--all オプションをパースする', () => {
      const result = parseUninstallArgs(['--all']);
      expect(result).toEqual({ all: true });
    });

    it('複合オプションをパースする', () => {
      const result = parseUninstallArgs(['--shell', 'bash', '--all']);
      expect(result).toEqual({ shell: 'bash', all: true });
    });

    it('空の引数は空オブジェクトを返す', () => {
      const result = parseUninstallArgs([]);
      expect(result).toEqual({});
    });

    it('無効なシェルは無視する', () => {
      const result = parseUninstallArgs(['--shell', 'invalid']);
      expect(result).toEqual({});
    });
  });

  describe('runUninstall', () => {
    describe('--all オプション', () => {
      it('全てのシェルと Kiro が未インストールの場合', () => {
        vi.mocked(existsSync).mockReturnValue(false);

        const result = runUninstall({ all: true });

        expect(result.success).toBe(true);
        expect(result.message).toContain('bash: not installed');
        expect(result.message).toContain('zsh: not installed');
        expect(result.message).toContain('fish: not installed');
        expect(result.message).toContain('kiro: not installed');
      });

      it('全てのシェルと Kiro がインストール済みの場合、削除する', () => {
        vi.mocked(existsSync).mockReturnValue(true);
        vi.mocked(readFileSync).mockReturnValue('# no marker');
        vi.mocked(unlinkSync).mockReturnValue(undefined);

        const result = runUninstall({ all: true });

        expect(result.success).toBe(true);
        expect(result.message).toContain('bash: removed from');
        expect(result.message).toContain('zsh: removed from');
        expect(result.message).toContain('fish: removed from');
        expect(result.message).toContain('kiro: removed from');
        // 4回 (bash, zsh, fish, kiro) 削除される
        expect(unlinkSync).toHaveBeenCalledTimes(4);
      });

      it('一部のシェルのみインストール済みの場合', () => {
        vi.mocked(existsSync).mockImplementation((path: unknown) => {
          // zsh と kiro のみインストール済み
          if (typeof path === 'string') {
            return path.includes('.zsh') || path.includes('.fig');
          }
          return false;
        });
        vi.mocked(readFileSync).mockReturnValue('# no marker');
        vi.mocked(unlinkSync).mockReturnValue(undefined);

        const result = runUninstall({ all: true });

        expect(result.success).toBe(true);
        expect(result.message).toContain('bash: not installed');
        expect(result.message).toContain('zsh: removed from');
        expect(result.message).toContain('fish: not installed');
        expect(result.message).toContain('kiro: removed from');
      });
    });

    describe('--shell オプション', () => {
      it('シェルが未インストールの場合', () => {
        vi.mocked(existsSync).mockReturnValue(false);

        const result = runUninstall({ shell: 'zsh' });

        expect(result.success).toBe(true);
        expect(result.message).toBe('zsh completion is not installed');
      });

      it('シェルがインストール済みの場合、削除する', () => {
        vi.mocked(existsSync).mockReturnValue(true);
        vi.mocked(readFileSync).mockReturnValue('# no marker');
        vi.mocked(unlinkSync).mockReturnValue(undefined);

        const result = runUninstall({ shell: 'zsh' });

        expect(result.success).toBe(true);
        expect(result.message).toContain('Removed zsh completion from:');
        expect(unlinkSync).toHaveBeenCalledTimes(1);
      });
    });

    describe('--kiro オプション', () => {
      it('Kiro が未インストールの場合', () => {
        vi.mocked(existsSync).mockReturnValue(false);

        const result = runUninstall({ kiro: true });

        expect(result.success).toBe(true);
        expect(result.message).toBe('Kiro/Fig spec is not installed');
      });

      it('Kiro がインストール済みの場合、削除する', () => {
        vi.mocked(existsSync).mockReturnValue(true);
        vi.mocked(unlinkSync).mockReturnValue(undefined);

        const result = runUninstall({ kiro: true });

        expect(result.success).toBe(true);
        expect(result.message).toContain('Removed Kiro/Fig spec from:');
        expect(unlinkSync).toHaveBeenCalledTimes(1);
      });
    });

    describe('オプションなし', () => {
      it('エラーメッセージを返す', () => {
        const result = runUninstall({});

        expect(result.success).toBe(false);
        expect(result.message).toBe(
          'Error: --shell, --kiro, or --all option is required'
        );
      });
    });

    describe('エラーハンドリング', () => {
      it('削除失敗時にエラーを返す', () => {
        vi.mocked(existsSync).mockReturnValue(true);
        vi.mocked(unlinkSync).mockImplementation(() => {
          throw new Error('Permission denied');
        });

        const result = runUninstall({ shell: 'zsh' });

        expect(result.success).toBe(false);
        expect(result.message).toContain('Failed to remove');
        expect(result.message).toContain('Permission denied');
      });

      it('--all で一部失敗した場合も全体は失敗扱い', () => {
        let callCount = 0;
        vi.mocked(existsSync).mockReturnValue(true);
        vi.mocked(readFileSync).mockReturnValue('# no marker');
        vi.mocked(unlinkSync).mockImplementation(() => {
          callCount++;
          // 2回目 (zsh) で失敗
          if (callCount === 2) {
            throw new Error('Permission denied');
          }
        });

        const result = runUninstall({ all: true });

        expect(result.success).toBe(false);
        expect(result.message).toContain('bash: removed from');
        expect(result.message).toContain('Failed to remove zsh');
      });
    });
  });
});
