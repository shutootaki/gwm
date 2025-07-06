/**
 * バリデーション共通ユーティリティ
 */

/**
 * ブランチ名をワークツリーパス用にサニタイズする
 * スラッシュをハイフンに置換する
 */
export function sanitizeBranchName(branch: string): string {
  return branch.replace(/\//g, '-');
}

/**
 * ブランチ名が有効かどうかをチェック
 */
export function isValidBranchName(branch: string): boolean {
  if (!branch || branch.trim() === '') {
    return false;
  }

  // Git ブランチ名の基本的なルール
  // - 空文字列ではない
  // - 制御文字を含まない
  // - 連続したドットを含まない
  // - スペースで開始・終了しない
  const trimmed = branch.trim();

  // 基本チェック
  if (trimmed.length === 0 || trimmed.length > 255) {
    return false;
  }

  // 制御文字や無効文字のチェック
  // eslint-disable-next-line no-control-regex
  if (/[\x00-\x1f\x7f~^:?*[\\\s]/.test(trimmed)) {
    return false;
  }

  // 連続ドットのチェック
  if (trimmed.includes('..')) {
    return false;
  }

  // 開始・終了文字のチェック
  if (trimmed.startsWith('.') || trimmed.endsWith('.')) {
    return false;
  }

  return true;
}

/**
 * 文字列が空でないかチェック
 */
export function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim() !== '';
}

/**
 * 配列が空でない文字列の配列かチェック
 */
export function isNonEmptyStringArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every((item): item is string => isNonEmptyString(item))
  );
}

/**
 * 数値が指定された範囲内にあるかチェック
 */
export function isNumberInRange(
  value: unknown,
  min: number,
  max: number
): value is number {
  return typeof value === 'number' && value >= min && value <= max;
}

/**
 * 非負の数値かチェック
 */
export function isNonNegativeNumber(value: unknown): value is number {
  return typeof value === 'number' && value >= 0;
}

/**
 * ファイルパスが安全かチェック（基本的なチェック）
 */
export function isSafePath(path: string): boolean {
  if (!isNonEmptyString(path)) {
    return false;
  }

  // パストラバーサル攻撃の基本的な防止
  if (path.includes('..') || path.includes('//')) {
    return false;
  }

  // null文字やその他の危険な文字
  // eslint-disable-next-line no-control-regex
  if (/[\x00\r\n]/.test(path)) {
    return false;
  }

  return true;
}

/**
 * オブジェクトが指定されたプロパティを持つかチェック
 */
export function hasProperty<T extends string>(
  obj: unknown,
  prop: T
): obj is Record<T, unknown> {
  return typeof obj === 'object' && obj !== null && prop in obj;
}

/**
 * 型ガード: オブジェクトかつnullでない
 */
export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
