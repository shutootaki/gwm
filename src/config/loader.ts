import { readFileSync, existsSync } from 'fs';
import { execSync } from 'child_process';
import { join } from 'path';
import { DEFAULT_CONFIG, getConfigPaths } from './defaults.js';
import { parseTOML, parseConfigFromTOML } from './parser.js';
import { deepMerge } from './merger.js';
import type { Config } from './types.js';

// キャッシュされた設定
let _cachedConfig: Config | undefined;

/**
 * テスト環境かどうかを判定
 */
function isTestEnvironment(): boolean {
  return process.env.VITEST !== undefined || process.env.NODE_ENV === 'test';
}

/**
 * Git リポジトリのルートディレクトリを取得
 * @returns リポジトリルートのパス、またはリポジトリ外なら null
 */
function tryGetRepoRoot(): string | null {
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
function getProjectConfigPath(): string | null {
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
