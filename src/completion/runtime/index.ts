/**
 * ランタイムのエントリーポイント
 */

// パーサ
export { parseTokens, getActiveCommand, type ParsedContext } from './parser.js';

// 候補生成
export { generateCandidates, runComplete } from './complete.js';
