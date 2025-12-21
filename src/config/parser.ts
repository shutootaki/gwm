import TOML from '@ltd/j-toml';
import { DEFAULT_CONFIG } from './defaults.js';
import type { Config, RawParsedConfig } from './types.js';

/**
 * TOML文字列をパースする
 */
export function parseTOML(content: string): RawParsedConfig {
  return TOML.parse(content) as RawParsedConfig;
}

/**
 * worktree_base_path設定を検証・処理
 */
function parseWorktreeBasePath(parsed: RawParsedConfig): string {
  return typeof parsed.worktree_base_path === 'string' &&
    parsed.worktree_base_path.trim()
    ? (parsed.worktree_base_path as string)
    : DEFAULT_CONFIG.worktree_base_path;
}

/**
 * main_branches設定を検証・処理
 */
function parseMainBranches(parsed: RawParsedConfig): string[] {
  const mainBranches = Array.isArray(parsed.main_branches)
    ? (parsed.main_branches as unknown[]).filter(
        (v): v is string => typeof v === 'string' && v.trim() !== ''
      )
    : DEFAULT_CONFIG.main_branches;

  return mainBranches.length > 0 ? mainBranches : DEFAULT_CONFIG.main_branches;
}

/**
 * clean_branch設定を検証・処理
 */
function parseCleanBranch(parsed: RawParsedConfig): 'auto' | 'ask' | 'never' {
  const cleanBranchRaw = parsed.clean_branch;
  return cleanBranchRaw === 'auto' || cleanBranchRaw === 'never'
    ? cleanBranchRaw
    : 'ask';
}

/**
 * copy_ignored_files設定を検証・処理
 */
function parseCopyIgnoredFiles(
  parsed: RawParsedConfig
): Config['copy_ignored_files'] {
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

  return copyIgnoredFiles;
}

/**
 * virtual_env_handling設定を検証・処理
 */
function parseVirtualEnvHandling(
  parsed: RawParsedConfig
): Config['virtual_env_handling'] {
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
      typeof copy_parallelism_raw === 'number' && copy_parallelism_raw >= 0
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

  return virtualEnvHandling;
}

/**
 * hooks設定を検証・処理
 */
function parseHooks(parsed: RawParsedConfig): Config['hooks'] {
  const defaultHooks = DEFAULT_CONFIG.hooks;

  if (!parsed.hooks || typeof parsed.hooks !== 'object') {
    return defaultHooks;
  }

  const hooksRaw = parsed.hooks as Record<string, unknown>;
  const result: Config['hooks'] = {};

  // post_create の解析
  if (hooksRaw.post_create && typeof hooksRaw.post_create === 'object') {
    const pc = hooksRaw.post_create as Record<string, unknown>;
    result.post_create = {
      enabled:
        typeof pc.enabled === 'boolean'
          ? pc.enabled
          : (defaultHooks?.post_create?.enabled ?? true),
      commands: Array.isArray(pc.commands)
        ? (pc.commands as unknown[]).filter(
            (v): v is string => typeof v === 'string'
          )
        : (defaultHooks?.post_create?.commands ?? []),
    };
  } else {
    result.post_create = defaultHooks?.post_create;
  }

  return result;
}

/**
 * パースされたTOMLデータを設定オブジェクトに変換
 */
export function parseConfigFromTOML(parsed: RawParsedConfig): Config {
  return {
    worktree_base_path: parseWorktreeBasePath(parsed),
    main_branches: parseMainBranches(parsed),
    clean_branch: parseCleanBranch(parsed),
    copy_ignored_files: parseCopyIgnoredFiles(parsed),
    virtual_env_handling: parseVirtualEnvHandling(parsed),
    hooks: parseHooks(parsed),
  };
}
