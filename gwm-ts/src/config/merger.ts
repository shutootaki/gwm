import type { Config } from './types.js';
import { isPlainObject } from './guards.js';

type ConfigValue = unknown;
type ConfigObject = Record<string, ConfigValue>;

/**
 * 2つの設定オブジェクトを深くマージする
 *
 * マージ規則:
 * - スカラー値（文字列/数値/真偽値）: project 設定が上書き
 * - ネストしたオブジェクト: 再帰的にマージ
 * - 配列: project 設定で全置換（結合しない）
 *
 * @param global グローバル設定
 * @param project プロジェクト設定（null の場合はグローバル設定をそのまま返す）
 * @returns マージされた設定
 */
export function deepMerge(
  global: Partial<Config>,
  project: Partial<Config> | null
): Config {
  if (!project) {
    return global as Config;
  }

  const result: ConfigObject = { ...global };

  for (const key of Object.keys(project)) {
    const globalValue = (global as ConfigObject)[key];
    const projectValue = (project as ConfigObject)[key];

    if (projectValue === undefined) {
      // project が undefined の場合は global の値を維持
      continue;
    }

    if (Array.isArray(projectValue)) {
      // 配列は全置換
      result[key] = projectValue;
    } else if (isPlainObject(projectValue) && isPlainObject(globalValue)) {
      // ネストしたオブジェクトは再帰マージ
      result[key] = deepMerge(
        globalValue as Partial<Config>,
        projectValue as Partial<Config>
      );
    } else {
      // スカラー値は project で上書き
      result[key] = projectValue;
    }
  }

  return result as unknown as Config;
}
