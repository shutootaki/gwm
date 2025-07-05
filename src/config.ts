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
   * 仮想環境処理の設定
   * mode: "skip" (検出したらコピーしない, デフォルト) | "ignore" (スキップしない)
   * custom_patterns: 任意の追加パターン
   */
  virtual_env_handling?: {
    /**
     * 仮想環境隔離機能を有効にするかどうか。
     * true  : 仮想環境ディレクトリをコピーせず、シンボリックリンクを書き換える
     * false : 従来通りコピーし、リンクもそのまま
     * ※ 旧フィールド mode ("skip"|"ignore") からの後方互換あり。
     */
    isolate_virtual_envs?: boolean;
    /** @deprecated v0.10 で削除予定。isolate_virtual_envs に置き換え */
    mode?: 'skip' | 'ignore';
    custom_patterns?: {
      language: string;
      patterns: string[];
      commands?: string[];
    }[];
    /**
     * 1ファイルあたりコピーを許可する最大サイズ (MB)。-1 または未設定で無制限。
     * ※ v0.9 以前との互換性のため、旧キー "max_copy_size_mb" も受け付ける。
     */
    max_file_size_mb?: number;
    /** 1ディレクトリ(合計)でコピーを許可する最大サイズ (MB)。-1 または未設定で無制限。*/
    max_dir_size_mb?: number;
    /** ディレクトリ走査の最大深さ。-1 で無制限 */
    max_scan_depth?: number;
    /** コピー処理の並列度。0 で論理 CPU コア数を利用 */
    copy_parallelism?: number;
    /**
     * @deprecated max_file_size_mb に置き換え予定
     */
    max_copy_size_mb?: number;
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

  virtual_env_handling: {
    isolate_virtual_envs: false,
    max_file_size_mb: 100,
    max_dir_size_mb: 500,
    max_scan_depth: 5,
    copy_parallelism: 4,
  },
};

// キャッシュされた設定
let _cachedConfig: Config | undefined;

/**
 * 設定を読み込む
 * @param forceReload true にするとキャッシュを無視して再読込する
 */
export function loadConfig(forceReload: boolean = false): Config {
  // Vitest や Jest 実行時はキャッシュを無効化する（forceReload でも上書き可能）
  const isTestEnv =
    process.env.VITEST !== undefined || process.env.NODE_ENV === 'test';

  if (!forceReload && _cachedConfig && !isTestEnv) {
    return _cachedConfig;
  }

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

        // virtual_env_handling の読み取り
        let virtualEnvHandling: Config['virtual_env_handling'] =
          DEFAULT_CONFIG.virtual_env_handling;

        if (
          parsed.virtual_env_handling &&
          typeof parsed.virtual_env_handling === 'object'
        ) {
          const veh = parsed.virtual_env_handling as Record<string, unknown>;

          const isolateRaw = veh['isolate_virtual_envs'];
          const modeRaw = veh['mode']; // deprecated

          // 後方互換: isolate_virtual_envs が優先。未指定なら mode を解釈。
          let isolate_virtual_envs: boolean;
          if (typeof isolateRaw === 'boolean') {
            isolate_virtual_envs = isolateRaw;
          } else if (modeRaw === 'ignore') {
            isolate_virtual_envs = false;
          } else if (modeRaw === 'skip') {
            isolate_virtual_envs = true;
          } else {
            isolate_virtual_envs = false; // デフォルト
          }

          const maxFileSizeRaw = veh['max_file_size_mb'];
          const maxCopySizeRaw = veh['max_copy_size_mb']; // deprecated key
          const max_file_size_mb =
            typeof maxFileSizeRaw === 'number' && maxFileSizeRaw >= -1
              ? maxFileSizeRaw
              : typeof maxCopySizeRaw === 'number' && maxCopySizeRaw >= 0
                ? maxCopySizeRaw
                : 100;
          const max_dir_size_mb_raw = veh['max_dir_size_mb'];
          const max_dir_size_mb =
            typeof max_dir_size_mb_raw === 'number' && max_dir_size_mb_raw >= -1
              ? max_dir_size_mb_raw
              : 500;
          const max_scan_depth_raw = veh['max_scan_depth'];
          const max_scan_depth =
            typeof max_scan_depth_raw === 'number' && max_scan_depth_raw >= -1
              ? max_scan_depth_raw
              : 5;
          const copy_parallelism_raw = veh['copy_parallelism'];
          const copy_parallelism =
            typeof copy_parallelism_raw === 'number' &&
            copy_parallelism_raw >= 0
              ? copy_parallelism_raw
              : 4;

          const customRaw = veh['custom_patterns'];
          let customPatternsFiltered:
            | {
                language: string;
                patterns: string[];
                commands?: string[];
              }[]
            | undefined;

          if (Array.isArray(customRaw)) {
            customPatternsFiltered = (customRaw as unknown[]).filter(
              (
                p
              ): p is {
                language: string;
                patterns: string[];
                commands?: string[];
              } =>
                typeof p === 'object' &&
                p !== null &&
                typeof (p as { language?: unknown }).language === 'string' &&
                Array.isArray((p as { patterns?: unknown }).patterns)
            );
          }

          virtualEnvHandling = {
            isolate_virtual_envs,
            custom_patterns: customPatternsFiltered,
            max_file_size_mb,
            max_dir_size_mb,
            max_scan_depth,
            copy_parallelism,
            // backward compatibility
            max_copy_size_mb:
              typeof maxCopySizeRaw === 'number' ? maxCopySizeRaw : undefined,
            mode:
              typeof modeRaw === 'string'
                ? (modeRaw as 'skip' | 'ignore')
                : undefined,
          };
        }

        _cachedConfig = {
          // 基本設定
          worktree_base_path: worktreeBasePath,
          main_branches:
            mainBranches.length > 0
              ? mainBranches
              : DEFAULT_CONFIG.main_branches,
          clean_branch: cleanBranch,
          copy_ignored_files: copyIgnoredFiles,

          // virtual_env_handling はユーザー設定の有無にかかわらず必ず含める。
          // ユーザー設定がなければ DEFAULT_CONFIG の既定値を使用する。
          virtual_env_handling: virtualEnvHandling,
        };

        return _cachedConfig;
      } catch (error) {
        console.error(`Error reading config file ${configPath}:`, error);
        continue;
      }
    }
  }

  // コンフィグファイルが見つからなかった場合は FULL DEFAULT を返す
  _cachedConfig = { ...DEFAULT_CONFIG };
  return _cachedConfig;
}

// テスト用: キャッシュをクリア
export function __resetConfigCache() {
  _cachedConfig = undefined;
}
