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
  /**
   * Python プロジェクト固有の設定
   */
  python?: {
    /**
     * Pythonプロジェクトの自動検出を有効にするか
     */
    auto_detect: boolean;
    /**
     * .venvディレクトリの自動除外を有効にするか
     */
    exclude_venv: boolean;
    /**
     * ワークツリー作成後にvenv再作成の提案を表示するか
     */
    suggest_venv_recreate: boolean;
    /**
     * Python固有の除外パターン
     */
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
  python: {
    auto_detect: true,
    exclude_venv: true,
    suggest_venv_recreate: true,
    exclude_patterns: ['.venv', '.venv/*', '__pycache__', '*.pyc', '*.pyo', '.pytest_cache'],
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

        // python設定の読み込み
        let pythonConfig = DEFAULT_CONFIG.python;
        if (
          parsed.python &&
          typeof parsed.python === 'object'
        ) {
          const py = parsed.python as Record<string, unknown>;
          pythonConfig = {
            auto_detect:
              typeof py.auto_detect === 'boolean'
                ? py.auto_detect
                : DEFAULT_CONFIG.python!.auto_detect,
            exclude_venv:
              typeof py.exclude_venv === 'boolean'
                ? py.exclude_venv
                : DEFAULT_CONFIG.python!.exclude_venv,
            suggest_venv_recreate:
              typeof py.suggest_venv_recreate === 'boolean'
                ? py.suggest_venv_recreate
                : DEFAULT_CONFIG.python!.suggest_venv_recreate,
            exclude_patterns: Array.isArray(py.exclude_patterns)
              ? (py.exclude_patterns as unknown[]).filter(
                  (v): v is string => typeof v === 'string'
                )
              : DEFAULT_CONFIG.python!.exclude_patterns,
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
          python: pythonConfig,
        };
      } catch (error) {
        console.error(`Error reading config file ${configPath}:`, error);
        continue;
      }
    }
  }

  return DEFAULT_CONFIG;
}
