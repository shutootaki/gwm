/**
 * 設定ファイルパース用の型ガード関数
 */

/**
 * 文字列配列かどうかを判定
 */
export function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((v) => typeof v === 'string');
}

/**
 * virtual_env_handling の mode 値かどうかを判定
 */
export function isModeString(value: unknown): value is 'skip' | 'ignore' {
  return value === 'skip' || value === 'ignore';
}

/**
 * プレーンオブジェクトかどうかを判定
 */
export function isPlainObject(
  value: unknown
): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    Object.prototype.toString.call(value) === '[object Object]'
  );
}

/**
 * clean_branch の値かどうかを判定
 */
export function isCleanBranchMode(
  value: unknown
): value is 'auto' | 'ask' | 'never' {
  return value === 'auto' || value === 'ask' || value === 'never';
}

/**
 * カスタム仮想環境パターンの型ガード
 */
export interface CustomVirtualEnvPattern {
  language: string;
  patterns: string[];
  commands?: string[];
}

export function isCustomVirtualEnvPattern(
  value: unknown
): value is CustomVirtualEnvPattern {
  if (!isPlainObject(value)) return false;
  if (typeof value.language !== 'string') return false;
  if (!isStringArray(value.patterns)) return false;
  if (value.commands !== undefined && !isStringArray(value.commands)) {
    return false;
  }
  return true;
}
