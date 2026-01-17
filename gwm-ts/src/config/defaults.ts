import { homedir } from 'os';
import { join } from 'path';
import type { Config } from './types.js';

export const DEFAULT_CONFIG: Config = {
  worktree_base_path: join(homedir(), 'git-worktrees'),
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

  hooks: {
    post_create: {
      enabled: true,
      commands: [],
    },
  },
};

/**
 * 設定ファイルのパス候補
 */
export function getConfigPaths(): string[] {
  return [
    join(homedir(), '.config', 'gwm', 'config.toml'),
    join(homedir(), '.gwmrc'),
  ];
}
