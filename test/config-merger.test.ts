import { describe, it, expect } from 'vitest';
import { deepMerge } from '../src/config/merger.js';
import type { Config } from '../src/config/types.js';

describe('deepMerge', () => {
  const baseGlobalConfig: Partial<Config> = {
    worktree_base_path: '/Users/global/worktrees',
    main_branches: ['main', 'master'],
    clean_branch: 'ask',
    hooks: {
      post_create: {
        enabled: true,
        commands: ['npm install'],
      },
    },
  };

  it('should return global config when project config is null', () => {
    const result = deepMerge(baseGlobalConfig, null);

    expect(result.worktree_base_path).toBe('/Users/global/worktrees');
    expect(result.main_branches).toEqual(['main', 'master']);
    expect(result.hooks?.post_create?.commands).toEqual(['npm install']);
  });

  it('should override scalar values with project config', () => {
    const projectConfig: Partial<Config> = {
      worktree_base_path: '/Users/project/worktrees',
    };

    const result = deepMerge(baseGlobalConfig, projectConfig);

    expect(result.worktree_base_path).toBe('/Users/project/worktrees');
    // 他の値はグローバルから継承
    expect(result.main_branches).toEqual(['main', 'master']);
  });

  it('should replace arrays entirely with project config', () => {
    const projectConfig: Partial<Config> = {
      main_branches: ['develop'],
    };

    const result = deepMerge(baseGlobalConfig, projectConfig);

    expect(result.main_branches).toEqual(['develop']);
  });

  it('should deep merge nested objects', () => {
    const projectConfig: Partial<Config> = {
      hooks: {
        post_create: {
          commands: ['pnpm install', 'pnpm build'],
        },
      },
    };

    const result = deepMerge(baseGlobalConfig, projectConfig);

    // commands はプロジェクト設定で置換される
    expect(result.hooks?.post_create?.commands).toEqual([
      'pnpm install',
      'pnpm build',
    ]);
    // enabled はグローバルから継承（プロジェクトで指定されていない場合）
    expect(result.hooks?.post_create?.enabled).toBe(true);
  });

  it('should allow project config to disable hooks', () => {
    const projectConfig: Partial<Config> = {
      hooks: {
        post_create: {
          enabled: false,
        },
      },
    };

    const result = deepMerge(baseGlobalConfig, projectConfig);

    expect(result.hooks?.post_create?.enabled).toBe(false);
    // commands はグローバルから継承
    expect(result.hooks?.post_create?.commands).toEqual(['npm install']);
  });

  it('should merge copy_ignored_files settings', () => {
    const globalWithCopy: Partial<Config> = {
      ...baseGlobalConfig,
      copy_ignored_files: {
        enabled: true,
        patterns: ['.env', '.env.*'],
        exclude_patterns: ['.env.example'],
      },
    };

    const projectConfig: Partial<Config> = {
      copy_ignored_files: {
        patterns: ['.env', '.secrets'],
      },
    };

    const result = deepMerge(globalWithCopy, projectConfig);

    expect(result.copy_ignored_files?.enabled).toBe(true);
    expect(result.copy_ignored_files?.patterns).toEqual(['.env', '.secrets']);
    expect(result.copy_ignored_files?.exclude_patterns).toEqual([
      '.env.example',
    ]);
  });

  it('should merge virtual_env_handling settings', () => {
    const globalWithVenv: Partial<Config> = {
      ...baseGlobalConfig,
      virtual_env_handling: {
        isolate_virtual_envs: true,
        max_file_size_mb: 100,
        max_dir_size_mb: 500,
        max_scan_depth: 5,
        copy_parallelism: 4,
      },
    };

    const projectConfig: Partial<Config> = {
      virtual_env_handling: {
        max_file_size_mb: 50,
      },
    };

    const result = deepMerge(globalWithVenv, projectConfig);

    expect(result.virtual_env_handling?.isolate_virtual_envs).toBe(true);
    expect(result.virtual_env_handling?.max_file_size_mb).toBe(50);
    expect(result.virtual_env_handling?.max_dir_size_mb).toBe(500);
  });

  it('should handle empty project config', () => {
    const result = deepMerge(baseGlobalConfig, {});

    expect(result.worktree_base_path).toBe('/Users/global/worktrees');
    expect(result.main_branches).toEqual(['main', 'master']);
    expect(result.hooks?.post_create?.commands).toEqual(['npm install']);
  });

  it('should handle project config with new keys not in global', () => {
    const globalMinimal: Partial<Config> = {
      worktree_base_path: '/Users/global/worktrees',
      main_branches: ['main'],
      clean_branch: 'ask',
    };

    const projectConfig: Partial<Config> = {
      hooks: {
        post_create: {
          enabled: true,
          commands: ['npm install'],
        },
      },
    };

    const result = deepMerge(globalMinimal, projectConfig);

    expect(result.hooks?.post_create?.enabled).toBe(true);
    expect(result.hooks?.post_create?.commands).toEqual(['npm install']);
  });

  it('should preserve clean_branch from project if specified', () => {
    const projectConfig: Partial<Config> = {
      clean_branch: 'auto',
    };

    const result = deepMerge(baseGlobalConfig, projectConfig);

    expect(result.clean_branch).toBe('auto');
  });
});
