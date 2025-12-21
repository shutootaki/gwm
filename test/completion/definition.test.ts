/**
 * 補完定義のテスト
 */

import { describe, it, expect } from 'vitest';
import {
  completionDefinition,
  getAllCommandNames,
  findCommand,
  findSubcommand,
} from '../../src/completion/definition.js';

describe('completionDefinition', () => {
  it('rootName が gwm である', () => {
    expect(completionDefinition.rootName).toBe('gwm');
  });

  it('必須のコマンドが定義されている', () => {
    const commandNames = completionDefinition.commands.map((c) => c.name);
    expect(commandNames).toContain('list');
    expect(commandNames).toContain('add');
    expect(commandNames).toContain('go');
    expect(commandNames).toContain('remove');
    expect(commandNames).toContain('clean');
    expect(commandNames).toContain('pull-main');
    expect(commandNames).toContain('help');
    expect(commandNames).toContain('completion');
  });

  it('list コマンドに ls エイリアスがある', () => {
    const listCmd = completionDefinition.commands.find((c) => c.name === 'list');
    expect(listCmd?.aliases).toContain('ls');
  });

  it('remove コマンドに rm エイリアスがある', () => {
    const removeCmd = completionDefinition.commands.find(
      (c) => c.name === 'remove'
    );
    expect(removeCmd?.aliases).toContain('rm');
  });

  it('add コマンドに必要なオプションがある', () => {
    const addCmd = completionDefinition.commands.find((c) => c.name === 'add');
    const optionNames = addCmd?.options?.flatMap((o) => o.names) || [];
    expect(optionNames).toContain('-r');
    expect(optionNames).toContain('--remote');
    expect(optionNames).toContain('--from');
    expect(optionNames).toContain('--code');
    expect(optionNames).toContain('--cursor');
    expect(optionNames).toContain('--cd');
  });

  it('completion コマンドにサブコマンドがある', () => {
    const completionCmd = completionDefinition.commands.find(
      (c) => c.name === 'completion'
    );
    const subcommandNames =
      completionCmd?.subcommands?.map((s) => s.name) || [];
    expect(subcommandNames).toContain('script');
    expect(subcommandNames).toContain('install');
    expect(subcommandNames).toContain('uninstall');
    expect(subcommandNames).toContain('status');
  });

  it('隠しコマンドが hidden: true になっている', () => {
    const completionCmd = completionDefinition.commands.find(
      (c) => c.name === 'completion'
    );
    const hiddenCommands =
      completionCmd?.subcommands?.filter((s) => s.hidden) || [];
    const hiddenNames = hiddenCommands.map((s) => s.name);
    expect(hiddenNames).toContain('__complete');
    expect(hiddenNames).toContain('__fig_worktrees');
    expect(hiddenNames).toContain('__fig_branches_local');
    expect(hiddenNames).toContain('__fig_branches_remote');
  });
});

describe('getAllCommandNames', () => {
  it('エイリアスを含むコマンド名一覧を返す', () => {
    const names = getAllCommandNames();
    expect(names).toContain('list');
    expect(names).toContain('ls');
    expect(names).toContain('remove');
    expect(names).toContain('rm');
  });

  it('隠しコマンドを含まない', () => {
    const names = getAllCommandNames();
    expect(names).not.toContain('__complete');
    expect(names).not.toContain('__fig_worktrees');
  });
});

describe('findCommand', () => {
  it('コマンド名でコマンドを検索できる', () => {
    const cmd = findCommand('list');
    expect(cmd?.name).toBe('list');
  });

  it('エイリアスでコマンドを検索できる', () => {
    const cmd = findCommand('ls');
    expect(cmd?.name).toBe('list');
  });

  it('存在しないコマンドは undefined を返す', () => {
    const cmd = findCommand('nonexistent');
    expect(cmd).toBeUndefined();
  });
});

describe('findSubcommand', () => {
  it('サブコマンドを検索できる', () => {
    const completionCmd = findCommand('completion');
    expect(completionCmd).toBeDefined();
    const installSub = findSubcommand(completionCmd!, 'install');
    expect(installSub?.name).toBe('install');
  });

  it('存在しないサブコマンドは undefined を返す', () => {
    const completionCmd = findCommand('completion');
    expect(completionCmd).toBeDefined();
    const nonexistent = findSubcommand(completionCmd!, 'nonexistent');
    expect(nonexistent).toBeUndefined();
  });
});
