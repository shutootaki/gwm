/**
 * 補完機能のエントリーポイント
 */

// 型定義
export type {
  CompletionProviderId,
  CompletionArg,
  CompletionOption,
  CompletionCommand,
  CompletionDefinition,
  ShellType,
  CursorPosition,
} from './types.js';

// 単一ソース
export {
  completionDefinition,
  getAllCommandNames,
  findCommand,
  findSubcommand,
} from './definition.js';
