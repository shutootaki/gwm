import { readFileSync, existsSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import TOML from '@ltd/j-toml';

export interface Config {
  worktree_base_path: string;
  main_branches: string[];
  /**
   * worktree 削除後に同名ローカルブランチを掃除するかどうか
   * "auto" | "ask" | "never" (既定: "ask")
   */
  clean_branch: 'auto' | 'ask' | 'never';
}

const DEFAULT_CONFIG: Config = {
  worktree_base_path: join(homedir(), 'git-worktrees'),
  main_branches: ['main', 'master', 'develop'],
  clean_branch: 'ask',
};

export function loadConfig(): Config {
  const configPaths = [
    join(homedir(), '.config', 'gwm', 'config.toml'),
    join(homedir(), '.gwmrc'),
  ];

  for (const configPath of configPaths) {
    if (existsSync(configPath)) {
      try {
        const content = readFileSync(configPath, 'utf8');
        const parsed = TOML.parse(content) as Partial<Record<string, unknown>>;

        const worktreeBasePath =
          typeof parsed.worktree_base_path === 'string' &&
          parsed.worktree_base_path.trim()
            ? (parsed.worktree_base_path as string)
            : DEFAULT_CONFIG.worktree_base_path;

        const mainBranches = Array.isArray(parsed.main_branches)
          ? (parsed.main_branches as unknown[]).filter(
              (v): v is string => typeof v === 'string' && v.trim() !== ''
            )
          : DEFAULT_CONFIG.main_branches;

        const cleanBranchRaw = parsed.clean_branch;
        const cleanBranch =
          cleanBranchRaw === 'auto' || cleanBranchRaw === 'never'
            ? cleanBranchRaw
            : 'ask';

        return {
          worktree_base_path: worktreeBasePath,
          main_branches:
            mainBranches.length > 0
              ? mainBranches
              : DEFAULT_CONFIG.main_branches,
          clean_branch: cleanBranch,
        };
      } catch (error) {
        console.error(`Error reading config file ${configPath}:`, error);
        continue;
      }
    }
  }

  return DEFAULT_CONFIG;
}
