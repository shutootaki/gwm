// 型定義
export type { Config } from './types.js';

// 設定読み込み
export { loadConfig, __resetConfigCache } from './loader.js';

// デフォルト設定（必要に応じて）
export { DEFAULT_CONFIG } from './defaults.js';
