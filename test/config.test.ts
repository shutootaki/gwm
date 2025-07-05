import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { homedir } from 'os';
import TOML from '@ltd/j-toml';
import { loadConfig } from '../src/config.js';

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

    expect(result).toMatchObject({
      worktree_base_path: '/Users/test/git-worktrees',
      main_branches: ['main', 'master', 'develop'],
      clean_branch: 'ask',
      copy_ignored_files: {
        enabled: true,
        patterns: ['.env', '.env.*', '.env.local', '.env.*.local'],
        exclude_patterns: ['.env.example', '.env.sample'],
      },
      virtual_env_handling: {
        isolate_virtual_envs: false,
        max_file_size_mb: 100,
        max_dir_size_mb: 500,
        max_scan_depth: 5,
        copy_parallelism: 4,
      },
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
      clean_branch: 'ask',
    });

    const result = loadConfig();

    expect(result).toMatchObject({
      worktree_base_path: '/Users/test/my-worktrees',
      main_branches: ['main', 'development'],
      clean_branch: 'ask',
      copy_ignored_files: {
        enabled: true,
        patterns: ['.env', '.env.*', '.env.local', '.env.*.local'],
        exclude_patterns: ['.env.example', '.env.sample'],
      },
      virtual_env_handling: {
        isolate_virtual_envs: false,
        max_file_size_mb: 100,
        max_dir_size_mb: 500,
        max_scan_depth: 5,
        copy_parallelism: 4,
      },
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
      clean_branch: 'ask',
    });

    const result = loadConfig();

    expect(result).toMatchObject({
      worktree_base_path: '/Users/test/alternative-worktrees',
      main_branches: ['master'],
      clean_branch: 'ask',
      copy_ignored_files: {
        enabled: true,
        patterns: ['.env', '.env.*', '.env.local', '.env.*.local'],
        exclude_patterns: ['.env.example', '.env.sample'],
      },
      virtual_env_handling: {
        isolate_virtual_envs: false,
        max_file_size_mb: 100,
        max_dir_size_mb: 500,
        max_scan_depth: 5,
        copy_parallelism: 4,
      },
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
      clean_branch: 'ask',
    });

    const result = loadConfig();

    expect(result).toMatchObject({
      worktree_base_path: '/Users/test/primary-worktrees',
      main_branches: ['main'],
      clean_branch: 'ask',
      copy_ignored_files: {
        enabled: true,
        patterns: ['.env', '.env.*', '.env.local', '.env.*.local'],
        exclude_patterns: ['.env.example', '.env.sample'],
      },
      virtual_env_handling: {
        isolate_virtual_envs: false,
        max_file_size_mb: 100,
        max_dir_size_mb: 500,
        max_scan_depth: 5,
        copy_parallelism: 4,
      },
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
      clean_branch: 'ask',
    });

    const result = loadConfig();

    expect(result).toMatchObject({
      worktree_base_path: '/Users/test/custom-worktrees',
      main_branches: ['main', 'master', 'develop'], // デフォルト値
      clean_branch: 'ask',
      copy_ignored_files: {
        enabled: true,
        patterns: ['.env', '.env.*', '.env.local', '.env.*.local'],
        exclude_patterns: ['.env.example', '.env.sample'],
      },
      virtual_env_handling: {
        isolate_virtual_envs: false,
        max_file_size_mb: 100,
        max_dir_size_mb: 500,
        max_scan_depth: 5,
        copy_parallelism: 4,
      },
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

    expect(result).toMatchObject({
      worktree_base_path: '/Users/test/git-worktrees',
      main_branches: ['main', 'master', 'develop'],
      clean_branch: 'ask',
      copy_ignored_files: {
        enabled: true,
        patterns: ['.env', '.env.*', '.env.local', '.env.*.local'],
        exclude_patterns: ['.env.example', '.env.sample'],
      },
      virtual_env_handling: {
        isolate_virtual_envs: false,
        max_file_size_mb: 100,
        max_dir_size_mb: 500,
        max_scan_depth: 5,
        copy_parallelism: 4,
      },
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

    expect(result).toMatchObject({
      worktree_base_path: '/Users/test/git-worktrees',
      main_branches: ['main', 'master', 'develop'],
      clean_branch: 'ask',
      copy_ignored_files: {
        enabled: true,
        patterns: ['.env', '.env.*', '.env.local', '.env.*.local'],
        exclude_patterns: ['.env.example', '.env.sample'],
      },
      virtual_env_handling: {
        isolate_virtual_envs: false,
        max_file_size_mb: 100,
        max_dir_size_mb: 500,
        max_scan_depth: 5,
        copy_parallelism: 4,
      },
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

    expect(result).toMatchObject({
      worktree_base_path: '/Users/test/git-worktrees',
      main_branches: ['main', 'master', 'develop'],
      clean_branch: 'ask',
      copy_ignored_files: {
        enabled: true,
        patterns: ['.env', '.env.*', '.env.local', '.env.*.local'],
        exclude_patterns: ['.env.example', '.env.sample'],
      },
      virtual_env_handling: {
        isolate_virtual_envs: false,
        max_file_size_mb: 100,
        max_dir_size_mb: 500,
        max_scan_depth: 5,
        copy_parallelism: 4,
      },
    });
  });

  // copy_ignored_files設定のカスタマイズをテスト
  it('should load custom copy_ignored_files settings', () => {
    const configContent = `
worktree_base_path = "/Users/test/my-worktrees"
main_branches = ["main"]

[copy_ignored_files]
enabled = false
patterns = [".env", ".secret"]
exclude_patterns = [".env.test"]
`;

    mockExistsSync.mockImplementation((path) => {
      return path === '/Users/test/.config/gwm/config.toml';
    });

    mockReadFileSync.mockReturnValue(configContent);
    mockTOMLParse.mockReturnValue({
      worktree_base_path: '/Users/test/my-worktrees',
      main_branches: ['main'],
      copy_ignored_files: {
        enabled: false,
        patterns: ['.env', '.secret'],
        exclude_patterns: ['.env.test'],
      },
    });

    const result = loadConfig();

    expect(result.copy_ignored_files).toEqual({
      enabled: false,
      patterns: ['.env', '.secret'],
      exclude_patterns: ['.env.test'],
    });
  });

  // copy_ignored_files設定の部分的なカスタマイズをテスト
  it('should merge partial copy_ignored_files settings with defaults', () => {
    const configContent = `
worktree_base_path = "/Users/test/my-worktrees"

[copy_ignored_files]
enabled = false
`;

    mockExistsSync.mockImplementation((path) => {
      return path === '/Users/test/.config/gwm/config.toml';
    });

    mockReadFileSync.mockReturnValue(configContent);
    mockTOMLParse.mockReturnValue({
      worktree_base_path: '/Users/test/my-worktrees',
      copy_ignored_files: {
        enabled: false,
      },
    });

    const result = loadConfig();

    expect(result.copy_ignored_files).toEqual({
      enabled: false,
      patterns: ['.env', '.env.*', '.env.local', '.env.*.local'], // デフォルト値
      exclude_patterns: ['.env.example', '.env.sample'], // デフォルト値
    });
  });

  // copy_ignored_files設定の無効な値の処理をテスト
  it('should handle invalid copy_ignored_files settings gracefully', () => {
    const configContent = `
worktree_base_path = "/Users/test/my-worktrees"

[copy_ignored_files]
enabled = "true" # should be boolean
patterns = "not-an-array" # should be array
`;

    mockExistsSync.mockImplementation((path) => {
      return path === '/Users/test/.config/gwm/config.toml';
    });

    mockReadFileSync.mockReturnValue(configContent);
    mockTOMLParse.mockReturnValue({
      worktree_base_path: '/Users/test/my-worktrees',
      copy_ignored_files: {
        enabled: 'true', // 文字列（無効）
        patterns: 'not-an-array', // 文字列（無効）
      },
    });

    const result = loadConfig();

    // 無効な値はデフォルトにフォールバック
    expect(result.copy_ignored_files).toEqual({
      enabled: true, // デフォルト値
      patterns: ['.env', '.env.*', '.env.local', '.env.*.local'], // デフォルト値
      exclude_patterns: ['.env.example', '.env.sample'], // デフォルト値
    });
  });

  // copy_ignored_files設定がnullの場合の処理をテスト
  it('should use defaults when copy_ignored_files is null', () => {
    const configContent = `
worktree_base_path = "/Users/test/my-worktrees"
copy_ignored_files = null
`;

    mockExistsSync.mockImplementation((path) => {
      return path === '/Users/test/.config/gwm/config.toml';
    });

    mockReadFileSync.mockReturnValue(configContent);
    mockTOMLParse.mockReturnValue({
      worktree_base_path: '/Users/test/my-worktrees',
      copy_ignored_files: null,
    });

    const result = loadConfig();

    expect(result.copy_ignored_files).toEqual({
      enabled: true,
      patterns: ['.env', '.env.*', '.env.local', '.env.*.local'],
      exclude_patterns: ['.env.example', '.env.sample'],
    });
  });
});
