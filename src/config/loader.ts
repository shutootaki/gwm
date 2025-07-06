import { readFileSync, existsSync } from 'fs';
import { DEFAULT_CONFIG, getConfigPaths } from './defaults.js';
import { parseTOML, parseConfigFromTOML } from './parser.js';
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
 * 設定ファイルから設定を読み込む
 */
function loadConfigFromFile(): Config {
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

  // コンフィグファイルが見つからなかった場合はデフォルト設定を返す
  return { ...DEFAULT_CONFIG };
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
