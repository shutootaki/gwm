import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import TOML from '@ltd/j-toml';
import { loadConfig, Config } from '../src/config.js';

// モック化
vi.mock('fs', () => ({
  readFileSync: vi.fn(),
  existsSync: vi.fn(),
}));

vi.mock('os', () => ({
  homedir: vi.fn(() => '/Users/test'),
}));

vi.mock('@ltd/j-toml', () => ({
  default: {
    parse: vi.fn(),
  },
}));

const mockReadFileSync = vi.mocked(readFileSync);
const mockExistsSync = vi.mocked(existsSync);
const mockTOMLParse = vi.mocked(TOML.parse);
const mockHomedir = vi.mocked(homedir);

describe('loadConfig', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHomedir.mockReturnValue('/Users/test');
  });

  // 設定ファイルが存在しない場合のデフォルト設定返却をテスト
  it('should return default config when no config file exists', () => {
    mockExistsSync.mockReturnValue(false);

    const result = loadConfig();

    expect(result).toEqual({
      worktree_base_path: '/Users/test/git-worktrees',
      main_branches: ['main', 'master', 'develop'],
    });

    // 両方のパスをチェックしているか確認
    expect(mockExistsSync).toHaveBeenCalledWith(
      '/Users/test/.config/gwm/config.toml'
    );
    expect(mockExistsSync).toHaveBeenCalledWith('/Users/test/.gwmrc');
  });

  // ~/.config/gwm/config.tomlからの設定読み込みをテスト
  it('should load config from ~/.config/gwm/config.toml', () => {
    const configContent = `
worktree_base_path = "/Users/test/my-worktrees"
main_branches = ["main", "development"]
`;

    mockExistsSync.mockImplementation((path) => {
      return path === '/Users/test/.config/gwm/config.toml';
    });

    mockReadFileSync.mockReturnValue(configContent);
    mockTOMLParse.mockReturnValue({
      worktree_base_path: '/Users/test/my-worktrees',
      main_branches: ['main', 'development'],
    });

    const result = loadConfig();

    expect(result).toEqual({
      worktree_base_path: '/Users/test/my-worktrees',
      main_branches: ['main', 'development'],
    });

    expect(mockReadFileSync).toHaveBeenCalledWith(
      '/Users/test/.config/gwm/config.toml',
      'utf8'
    );
    expect(mockTOMLParse).toHaveBeenCalledWith(configContent);
  });

  // ~/.config/gwm/config.tomlが存在しない場合の~/.gwmrcからの設定読み込みをテスト
  it('should load config from ~/.gwmrc when ~/.config/gwm/config.toml does not exist', () => {
    const configContent = `
worktree_base_path = "/Users/test/alternative-worktrees"
main_branches = ["master"]
`;

    mockExistsSync.mockImplementation((path) => {
      return path === '/Users/test/.gwmrc';
    });

    mockReadFileSync.mockReturnValue(configContent);
    mockTOMLParse.mockReturnValue({
      worktree_base_path: '/Users/test/alternative-worktrees',
      main_branches: ['master'],
    });

    const result = loadConfig();

    expect(result).toEqual({
      worktree_base_path: '/Users/test/alternative-worktrees',
      main_branches: ['master'],
    });

    expect(mockReadFileSync).toHaveBeenCalledWith('/Users/test/.gwmrc', 'utf8');
  });

  // 両方の設定ファイルが存在する場合の優先度をテスト
  it('should prefer ~/.config/gwm/config.toml over ~/.gwmrc when both exist', () => {
    const primaryConfigContent = `
worktree_base_path = "/Users/test/primary-worktrees"
main_branches = ["main"]
`;

    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(primaryConfigContent);
    mockTOMLParse.mockReturnValue({
      worktree_base_path: '/Users/test/primary-worktrees',
      main_branches: ['main'],
    });

    const result = loadConfig();

    expect(result).toEqual({
      worktree_base_path: '/Users/test/primary-worktrees',
      main_branches: ['main'],
    });

    // 最初のファイルのみ読み込まれることを確認
    expect(mockReadFileSync).toHaveBeenCalledTimes(1);
    expect(mockReadFileSync).toHaveBeenCalledWith(
      '/Users/test/.config/gwm/config.toml',
      'utf8'
    );
  });

  // 部分的な設定とデフォルト値のマージをテスト
  it('should merge config with defaults when partial config is provided', () => {
    const partialConfigContent = `
worktree_base_path = "/Users/test/custom-worktrees"
`;

    mockExistsSync.mockImplementation((path) => {
      return path === '/Users/test/.config/gwm/config.toml';
    });

    mockReadFileSync.mockReturnValue(partialConfigContent);
    mockTOMLParse.mockReturnValue({
      worktree_base_path: '/Users/test/custom-worktrees',
    });

    const result = loadConfig();

    expect(result).toEqual({
      worktree_base_path: '/Users/test/custom-worktrees',
      main_branches: ['main', 'master', 'develop'], // デフォルト値
    });
  });

  // TOML解析失敗時のデフォルト設定フォールバックをテスト
  it('should fallback to default config when TOML parsing fails', () => {
    const invalidConfigContent = `
worktree_base_path = /invalid/toml/syntax
`;

    mockExistsSync.mockImplementation((path) => {
      return path === '/Users/test/.config/gwm/config.toml';
    });

    mockReadFileSync.mockReturnValue(invalidConfigContent);
    mockTOMLParse.mockImplementation(() => {
      throw new Error('Invalid TOML syntax');
    });

    // console.errorをモック化してエラーログを検証
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    const result = loadConfig();

    expect(result).toEqual({
      worktree_base_path: '/Users/test/git-worktrees',
      main_branches: ['main', 'master', 'develop'],
    });

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Error reading config file /Users/test/.config/gwm/config.toml:',
      expect.any(Error)
    );

    consoleErrorSpy.mockRestore();
  });

  // ファイル読み込み失敗時のデフォルト設定フォールバックをテスト
  it('should fallback to default config when file reading fails', () => {
    mockExistsSync.mockImplementation((path) => {
      return path === '/Users/test/.config/gwm/config.toml';
    });

    mockReadFileSync.mockImplementation(() => {
      throw new Error('Permission denied');
    });

    // console.errorをモック化
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    const result = loadConfig();

    expect(result).toEqual({
      worktree_base_path: '/Users/test/git-worktrees',
      main_branches: ['main', 'master', 'develop'],
    });

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Error reading config file /Users/test/.config/gwm/config.toml:',
      expect.any(Error)
    );

    consoleErrorSpy.mockRestore();
  });

  it('should handle empty config file gracefully', () => {
    mockExistsSync.mockImplementation((path) => {
      return path === '/Users/test/.config/gwm/config.toml';
    });

    mockReadFileSync.mockReturnValue('');
    mockTOMLParse.mockReturnValue({});

    const result = loadConfig();

    expect(result).toEqual({
      worktree_base_path: '/Users/test/git-worktrees',
      main_branches: ['main', 'master', 'develop'],
    });
  });
});
