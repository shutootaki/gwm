/**
 * トークンパーサのテスト
 */

import { describe, it, expect } from 'vitest';
import {
  parseTokens,
  getActiveCommand,
} from '../../../src/completion/runtime/parser.js';

describe('parseTokens', () => {
  describe('サブコマンド補完', () => {
    it('空のトークンでサブコマンド補完になる', () => {
      const context = parseTokens([], 0);
      expect(context.cursorPosition).toBe('subcommand');
      expect(context.command).toBeUndefined();
    });

    it('先頭のトークンがサブコマンド名になる', () => {
      const context = parseTokens(['list'], 0);
      expect(context.cursorPosition).toBe('subcommand');
      expect(context.currentToken).toBe('list');
    });
  });

  describe('コマンド解析', () => {
    it('list コマンドを認識する', () => {
      const context = parseTokens(['list'], 1);
      expect(context.command?.name).toBe('list');
    });

    it('ls エイリアスを認識する', () => {
      const context = parseTokens(['ls'], 1);
      expect(context.command?.name).toBe('list');
    });

    it('add コマンドを認識する', () => {
      const context = parseTokens(['add'], 1);
      expect(context.command?.name).toBe('add');
    });
  });

  describe('オプション補完', () => {
    it('- で始まるトークンはオプション補完', () => {
      const context = parseTokens(['add', '--'], 1);
      expect(context.cursorPosition).toBe('option');
    });

    it('入力済みオプションを追跡する', () => {
      const context = parseTokens(['add', '--remote', ''], 2);
      expect(context.completedOptions).toContain('--remote');
      expect(context.completedOptions).toContain('-r');
    });
  });

  describe('オプション値補完', () => {
    it('--from の後は値補完', () => {
      const context = parseTokens(['add', '--from', ''], 2);
      expect(context.cursorPosition).toBe('optionValue');
      expect(context.currentOptionNeedingValue?.names).toContain('--from');
    });

    it('--clean-branch の後は値補完', () => {
      const context = parseTokens(['remove', '--clean-branch', ''], 2);
      expect(context.cursorPosition).toBe('optionValue');
      expect(context.currentOptionNeedingValue?.names).toContain('--clean-branch');
    });
  });

  describe('位置引数補完', () => {
    it('go コマンドの引数は位置引数補完', () => {
      const context = parseTokens(['go', ''], 1);
      expect(context.cursorPosition).toBe('positional');
    });

    it('remove コマンドの引数は位置引数補完', () => {
      const context = parseTokens(['remove', ''], 1);
      expect(context.cursorPosition).toBe('positional');
    });
  });

  describe('-r/--remote フラグ追跡', () => {
    it('-r フラグを追跡する', () => {
      const context = parseTokens(['add', '-r', ''], 2);
      expect(context.hasRemoteFlag).toBe(true);
    });

    it('--remote フラグを追跡する', () => {
      const context = parseTokens(['add', '--remote', ''], 2);
      expect(context.hasRemoteFlag).toBe(true);
    });

    it('フラグなしでは false', () => {
      const context = parseTokens(['add', ''], 1);
      expect(context.hasRemoteFlag).toBe(false);
    });
  });

  describe('completion サブコマンド', () => {
    it('completion install を認識する', () => {
      const context = parseTokens(['completion', 'install', ''], 2);
      expect(context.command?.name).toBe('completion');
      expect(context.subcommand?.name).toBe('install');
    });
  });
});

describe('getActiveCommand', () => {
  it('サブコマンドがあればサブコマンドを返す', () => {
    const context = parseTokens(['completion', 'install', ''], 2);
    const active = getActiveCommand(context);
    expect(active?.name).toBe('install');
  });

  it('サブコマンドがなければコマンドを返す', () => {
    const context = parseTokens(['add', ''], 1);
    const active = getActiveCommand(context);
    expect(active?.name).toBe('add');
  });
});
