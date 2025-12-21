/**
 * テスト環境かどうかを判定
 *
 * Vitest または Jest 実行時に true を返す
 */
export function isTestEnvironment(): boolean {
  return process.env.VITEST !== undefined || process.env.NODE_ENV === 'test';
}
