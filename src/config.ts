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
  /**
   * gitignoreされたファイルのコピー設定
   */
  copy_ignored_files?: {
    enabled: boolean;
    patterns: string[];
    exclude_patterns?: string[];
  };
}

const DEFAULT_CONFIG: Config = {
  worktree_base_path: join(homedir(), 'git-worktrees'),
  main_branches: ['main', 'master', 'develop'],
  clean_branch: 'ask',
  copy_ignored_files: {
    enabled: true,
    patterns: ['.env', '.env.*', '.env.local', '.env.*.local'],
    exclude_patterns: ['.env.example', '.env.sample'],
  },
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

        // copy_ignored_files設定の読み込み
        let copyIgnoredFiles = DEFAULT_CONFIG.copy_ignored_files;
        if (
          parsed.copy_ignored_files &&
          typeof parsed.copy_ignored_files === 'object'
        ) {
          const cif = parsed.copy_ignored_files as Record<string, unknown>;
          copyIgnoredFiles = {
            enabled:
              typeof cif.enabled === 'boolean'
                ? cif.enabled
                : DEFAULT_CONFIG.copy_ignored_files!.enabled,
            patterns: Array.isArray(cif.patterns)
              ? (cif.patterns as unknown[]).filter(
                  (v): v is string => typeof v === 'string'
                )
              : DEFAULT_CONFIG.copy_ignored_files!.patterns,
            exclude_patterns: Array.isArray(cif.exclude_patterns)
              ? (cif.exclude_patterns as unknown[]).filter(
                  (v): v is string => typeof v === 'string'
                )
              : DEFAULT_CONFIG.copy_ignored_files!.exclude_patterns,
          };
        }

        return {
          worktree_base_path: worktreeBasePath,
          main_branches:
            mainBranches.length > 0
              ? mainBranches
              : DEFAULT_CONFIG.main_branches,
          clean_branch: cleanBranch,
          copy_ignored_files: copyIgnoredFiles,
        };
      } catch (error) {
        console.error(`Error reading config file ${configPath}:`, error);
        continue;
      }
    }
  }

  return DEFAULT_CONFIG;
}
