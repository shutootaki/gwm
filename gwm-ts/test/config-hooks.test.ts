import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { existsSync, readFileSync } from 'fs';
import { execSync } from 'child_process';
import { homedir } from 'os';
import TOML from '@ltd/j-toml';
import { loadConfig, __resetConfigCache } from '../src/config/index.js';

// モジュールモックを先に宣言
vi.mock('fs', () => ({
  readFileSync: vi.fn(),
  existsSync: vi.fn(),
}));

vi.mock('child_process', () => ({
  execSync: vi.fn(),
}));

vi.mock('os', () => ({
  homedir: vi.fn(() => '/Users/test'),
}));

vi.mock('@ltd/j-toml', () => ({
  default: {
    parse: vi.fn(),
  },
}));

const mockExistsSync = vi.mocked(existsSync);
const mockReadFileSync = vi.mocked(readFileSync);
const mockExecSync = vi.mocked(execSync);
const mockHomedir = vi.mocked(homedir);
const mockTOMLParse = vi.mocked(TOML.parse);

describe('config hooks parsing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    __resetConfigCache();
    mockHomedir.mockReturnValue('/Users/test');
    // プロジェクト設定は存在しない想定
    mockExecSync.mockImplementation(() => {
      throw new Error('not a git repo');
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should parse hooks.post_create with enabled and commands', () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue('dummy');
    mockTOMLParse.mockReturnValue({
      worktree_base_path: '/Users/test/worktrees',
      main_branches: ['main'],
      clean_branch: 'ask',
      hooks: {
        post_create: {
          enabled: true,
          commands: ['npm install', 'npm run build'],
        },
      },
    });

    const config = loadConfig();

    expect(config.hooks?.post_create?.enabled).toBe(true);
    expect(config.hooks?.post_create?.commands).toEqual([
      'npm install',
      'npm run build',
    ]);
  });

  it('should parse hooks.post_create with only commands (enabled defaults to true)', () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue('dummy');
    mockTOMLParse.mockReturnValue({
      worktree_base_path: '/Users/test/worktrees',
      main_branches: ['main'],
      clean_branch: 'ask',
      hooks: {
        post_create: {
          commands: ['pnpm install'],
        },
      },
    });

    const config = loadConfig();

    // enabled はデフォルトで true が適用される
    expect(config.hooks?.post_create?.enabled).toBe(true);
    expect(config.hooks?.post_create?.commands).toEqual(['pnpm install']);
  });

  it('should parse hooks.post_create with enabled = false', () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue('dummy');
    mockTOMLParse.mockReturnValue({
      worktree_base_path: '/Users/test/worktrees',
      main_branches: ['main'],
      clean_branch: 'ask',
      hooks: {
        post_create: {
          enabled: false,
          commands: ['npm install'],
        },
      },
    });

    const config = loadConfig();

    expect(config.hooks?.post_create?.enabled).toBe(false);
    expect(config.hooks?.post_create?.commands).toEqual(['npm install']);
  });

  it('should have default hooks when config has no hooks section', () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue('dummy');
    mockTOMLParse.mockReturnValue({
      worktree_base_path: '/Users/test/worktrees',
      main_branches: ['main'],
      clean_branch: 'ask',
    });

    const config = loadConfig();

    // デフォルト値が適用される
    expect(config.hooks).toBeDefined();
    expect(config.hooks?.post_create?.enabled).toBe(true);
    expect(config.hooks?.post_create?.commands).toEqual([]);
  });

  it('should apply defaults to empty hooks section', () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue('dummy');
    mockTOMLParse.mockReturnValue({
      worktree_base_path: '/Users/test/worktrees',
      main_branches: ['main'],
      clean_branch: 'ask',
      hooks: {},
    });

    const config = loadConfig();

    // 空の hooks セクションでもデフォルト値が適用される
    expect(config.hooks?.post_create?.enabled).toBe(true);
    expect(config.hooks?.post_create?.commands).toEqual([]);
  });

  it('should handle hooks.post_create with empty commands array', () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue('dummy');
    mockTOMLParse.mockReturnValue({
      worktree_base_path: '/Users/test/worktrees',
      main_branches: ['main'],
      clean_branch: 'ask',
      hooks: {
        post_create: {
          enabled: true,
          commands: [],
        },
      },
    });

    const config = loadConfig();

    expect(config.hooks?.post_create?.enabled).toBe(true);
    expect(config.hooks?.post_create?.commands).toEqual([]);
  });

  it('should parse complex hooks configuration', () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue('dummy');
    mockTOMLParse.mockReturnValue({
      worktree_base_path: '/Users/test/worktrees',
      main_branches: ['main', 'develop'],
      clean_branch: 'auto',
      copy_ignored_files: {
        enabled: true,
        patterns: ['.env', '.env.*'],
        exclude_patterns: ['.env.example'],
      },
      hooks: {
        post_create: {
          enabled: true,
          commands: ['npm install', 'npm run build', 'cp .env.example .env'],
        },
      },
    });

    const config = loadConfig();

    expect(config.worktree_base_path).toBe('/Users/test/worktrees');
    expect(config.hooks?.post_create?.enabled).toBe(true);
    expect(config.hooks?.post_create?.commands).toHaveLength(3);
    expect(config.copy_ignored_files?.enabled).toBe(true);
  });

  it('should ignore invalid hooks configuration gracefully', () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue('dummy');
    mockTOMLParse.mockReturnValue({
      worktree_base_path: '/Users/test/worktrees',
      main_branches: ['main'],
      clean_branch: 'ask',
      hooks: {
        post_create: {
          commands: 'not an array', // 不正な形式
        },
      },
    });

    const config = loadConfig();

    // 不正な形式はデフォルトに置換される
    expect(
      config.hooks?.post_create?.commands === undefined ||
        Array.isArray(config.hooks?.post_create?.commands)
    ).toBe(true);
  });
});

// Note: config priority tests (project > global) are covered by config-merger.test.ts
// The deepMerge function is tested there with direct unit tests
