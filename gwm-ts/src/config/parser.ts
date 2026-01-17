import TOML from '@ltd/j-toml';
import { DEFAULT_CONFIG } from './defaults.js';
import type { Config, RawParsedConfig } from './types.js';
import {
  isCleanBranchMode,
  isCustomVirtualEnvPattern,
  isModeString,
  isPlainObject,
  isStringArray,
} from './guards.js';

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
  return isCleanBranchMode(parsed.clean_branch) ? parsed.clean_branch : 'ask';
}

/**
 * copy_ignored_files設定を検証・処理
 *
 * セクションが存在する場合、enabled のデフォルトは true
 * （設定を書いたら有効になる、という直感的な動作）
 */
function parseCopyIgnoredFiles(
  parsed: RawParsedConfig
): Config['copy_ignored_files'] {
  const defaults = DEFAULT_CONFIG.copy_ignored_files!;

  // セクションが存在しない場合はデフォルト設定を返す
  if (!isPlainObject(parsed.copy_ignored_files)) {
    return defaults;
  }

  const cif = parsed.copy_ignored_files;

  return {
    // セクションが存在する場合、enabled のデフォルトは true
    enabled: typeof cif.enabled === 'boolean' ? cif.enabled : true,
    patterns: isStringArray(cif.patterns) ? cif.patterns : defaults.patterns,
    exclude_patterns: isStringArray(cif.exclude_patterns)
      ? cif.exclude_patterns
      : defaults.exclude_patterns,
  };
}

/**
 * virtual_env_handling設定を検証・処理
 */
function parseVirtualEnvHandling(
  parsed: RawParsedConfig
): Config['virtual_env_handling'] {
  let virtualEnvHandling: Config['virtual_env_handling'] =
    DEFAULT_CONFIG.virtual_env_handling;

  if (isPlainObject(parsed.virtual_env_handling)) {
    const veh = parsed.virtual_env_handling;

    const isolateRaw = veh['isolate_virtual_envs'];
    const modeRaw = veh['mode']; // deprecated

    // 後方互換: isolate_virtual_envs が優先。未指定なら mode を解釈。
    let isolate_virtual_envs: boolean;
    if (typeof isolateRaw === 'boolean') {
      isolate_virtual_envs = isolateRaw;
    } else if (isModeString(modeRaw)) {
      isolate_virtual_envs = modeRaw === 'skip';
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
    const customPatternsFiltered = Array.isArray(customRaw)
      ? customRaw.filter(isCustomVirtualEnvPattern)
      : undefined;

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
      mode: isModeString(modeRaw) ? modeRaw : undefined,
    };
  }

  return virtualEnvHandling;
}

/**
 * hooks設定を検証・処理
 *
 * セクションが存在する場合、enabled のデフォルトは true
 * （設定を書いたら有効になる、という直感的な動作）
 */
function parseHooks(parsed: RawParsedConfig): Config['hooks'] {
  const defaults = DEFAULT_CONFIG.hooks;

  // hooks セクションが存在しない場合はデフォルト設定を返す
  if (!isPlainObject(parsed.hooks)) {
    return defaults;
  }

  const hooksRaw = parsed.hooks;
  const result: Config['hooks'] = {};

  // post_create の解析
  if (isPlainObject(hooksRaw.post_create)) {
    const pc = hooksRaw.post_create;
    result.post_create = {
      // セクションが存在する場合、enabled のデフォルトは true
      enabled: typeof pc.enabled === 'boolean' ? pc.enabled : true,
      commands: isStringArray(pc.commands)
        ? pc.commands
        : (defaults?.post_create?.commands ?? []),
    };
  } else {
    result.post_create = defaults?.post_create;
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
