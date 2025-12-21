import { readFileSync, existsSync } from 'fs';
import { execSync } from 'child_process';
import { join } from 'path';
import { DEFAULT_CONFIG, getConfigPaths } from './defaults.js';
import { parseTOML, parseConfigFromTOML } from './parser.js';
import { deepMerge } from './merger.js';
import { isTestEnvironment } from '../utils/common/index.js';
import type { Config } from './types.js';

// キャッシュされた設定
let _cachedConfig: Config | undefined;

/**
 * Git リポジトリのルートディレクトリを取得
 * @returns リポジトリルートのパス、またはリポジトリ外なら null
 */
export function tryGetRepoRoot(): string | null {
  try {
    return execSync('git rev-parse --show-toplevel', {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
  } catch {
    return null;
  }
}

/**
 * プロジェクト設定ファイルのパスを取得
 * @returns プロジェクト設定パス、またはリポジトリ外なら null
 */
export function getProjectConfigPath(): string | null {
  const repoRoot = tryGetRepoRoot();
  if (!repoRoot) {
    return null;
  }
  return join(repoRoot, 'gwm', 'config.toml');
}

/**
 * グローバル設定ファイルを読み込む
 */
function loadGlobalConfig(): Partial<Config> {
  const configPaths = getConfigPaths();

  for (const configPath of configPaths) {
    if (existsSync(configPath)) {
      try {
        const content = readFileSync(configPath, 'utf8');
        const parsed = parseTOML(content);
        return parseConfigFromTOML(parsed);
      } catch (error) {
        console.error(`Error reading config file ${configPath}:`, error);
        continue;
      }
    }
  }

  return { ...DEFAULT_CONFIG };
}

/**
 * プロジェクト設定ファイルを読み込む
 */
function loadProjectConfig(): Partial<Config> | null {
  const projectConfigPath = getProjectConfigPath();

  if (!projectConfigPath || !existsSync(projectConfigPath)) {
    return null;
  }

  try {
    const content = readFileSync(projectConfigPath, 'utf8');
    const parsed = parseTOML(content);
    return parseConfigFromTOML(parsed);
  } catch (error) {
    console.error(
      `Error reading project config file ${projectConfigPath}:`,
      error
    );
    return null;
  }
}

/**
 * 設定ファイルから設定を読み込む（マージ対応）
 */
function loadConfigFromFile(): Config {
  const globalConfig = loadGlobalConfig();
  const projectConfig = loadProjectConfig();

  return deepMerge(globalConfig, projectConfig);
}

/**
 * 設定を読み込む
 * @param forceReload true にするとキャッシュを無視して再読込する
 */
export function loadConfig(forceReload: boolean = false): Config {
  // Vitest や Jest 実行時はキャッシュを無効化する（forceReload でも上書き可能）
  const isTestEnv = isTestEnvironment();

  if (!forceReload && _cachedConfig && !isTestEnv) {
    return _cachedConfig;
  }

  _cachedConfig = loadConfigFromFile();
  return _cachedConfig;
}

/**
 * テスト用: キャッシュをクリア
 */
export function __resetConfigCache(): void {
  _cachedConfig = undefined;
}

/**
 * 設定のソース情報付きで設定を読み込む
 */
export interface ConfigWithSource {
  config: Config;
  /** プロジェクト設定にhooksが含まれるか */
  hasProjectHooks: boolean;
  /** プロジェクト設定ファイルのパス（なければnull） */
  projectConfigPath: string | null;
  /** リポジトリルートパス（なければnull） */
  repoRoot: string | null;
}

/**
 * 設定をソース情報付きで読み込む
 * 信頼確認のために、プロジェクト設定にhooksが含まれるかを判定する
 */
export function loadConfigWithSource(): ConfigWithSource {
  const repoRoot = tryGetRepoRoot();
  const globalConfig = loadGlobalConfig();
  const projectConfig = loadProjectConfig();
  const projectConfigPath = getProjectConfigPath();

  // プロジェクト設定にhooksが含まれるかどうかを判定
  const hasProjectHooks = !!(
    projectConfig?.hooks?.post_create?.commands?.length &&
    projectConfig?.hooks?.post_create?.enabled !== false
  );

  return {
    config: deepMerge(globalConfig, projectConfig),
    hasProjectHooks,
    projectConfigPath:
      projectConfigPath && existsSync(projectConfigPath)
        ? projectConfigPath
        : null,
    repoRoot,
  };
}
