/**
 * トークン解析ロジック
 * シェルから渡されたトークン列を解析して補完コンテキストを特定
 */

import type {
  CompletionCommand,
  CompletionOption,
  CursorPosition,
} from '../types.js';
import { findCommand, findSubcommand } from '../definition.js';

/**
 * 解析されたコンテキスト
 */
export interface ParsedContext {
  /** 現在のコマンド（第1レベル） */
  command?: CompletionCommand;
  /** 現在のサブコマンド（第2レベル） */
  subcommand?: CompletionCommand;
  /** 値が必要なオプション（現在補完中） */
  currentOptionNeedingValue?: CompletionOption;
  /** すでに入力済みのオプション名 */
  completedOptions: string[];
  /** すでに入力済みの位置引数 */
  positionalArgs: string[];
  /** 現在のトークン（補完対象） */
  currentToken: string;
  /** カーソル位置の状態 */
  cursorPosition: CursorPosition;
  /** -r/--remote フラグが指定されているか（add コマンド用） */
  hasRemoteFlag: boolean;
}

/**
 * オプション名かどうか判定
 */
function isOptionLike(token: string): boolean {
  return token.startsWith('-');
}

/**
 * コマンドからオプションを検索
 */
function findOption(
  command: CompletionCommand | undefined,
  optionName: string
): CompletionOption | undefined {
  if (!command?.options) {
    return undefined;
  }
  return command.options.find((opt) => opt.names.includes(optionName));
}

/**
 * トークン列を解析してコンテキストを返す
 * @param tokens トークン列（gwm 自体は除く）
 * @param cword 現在補完中のトークンインデックス
 */
export function parseTokens(tokens: string[], cword: number): ParsedContext {
  const context: ParsedContext = {
    completedOptions: [],
    positionalArgs: [],
    currentToken: cword >= 0 && cword < tokens.length ? tokens[cword] : '',
    cursorPosition: 'subcommand',
    hasRemoteFlag: false,
  };

  // 空の場合はサブコマンド補完
  if (tokens.length === 0) {
    return context;
  }

  let tokenIndex = 0;
  let pendingOptionForValue: CompletionOption | undefined;

  // 最初のトークンがサブコマンドかどうか判定
  const firstToken = tokens[0];
  if (!isOptionLike(firstToken)) {
    context.command = findCommand(firstToken);
    tokenIndex = 1;
  }

  // コマンドが見つからなければサブコマンド補完
  if (!context.command) {
    context.cursorPosition = 'subcommand';
    return context;
  }

  // 2番目のトークン以降を解析
  while (tokenIndex < tokens.length) {
    const token = tokens[tokenIndex];
    const isCurrentToken = tokenIndex === cword;

    // 前のオプションが値を待っている場合
    if (pendingOptionForValue) {
      if (!isCurrentToken) {
        // 値が入力された
        context.completedOptions.push(...pendingOptionForValue.names);
      } else {
        // 現在のトークンがオプション値
        context.currentOptionNeedingValue = pendingOptionForValue;
        context.cursorPosition = 'optionValue';
        return context;
      }
      pendingOptionForValue = undefined;
      tokenIndex++;
      continue;
    }

    // サブコマンドの可能性をチェック（completion コマンドの場合）
    if (
      !context.subcommand &&
      context.command.subcommands &&
      !isOptionLike(token)
    ) {
      const sub = findSubcommand(context.command, token);
      if (sub) {
        context.subcommand = sub;
        tokenIndex++;
        continue;
      }
    }

    // オプションの場合
    if (isOptionLike(token)) {
      // --option=value 形式の処理
      const eqIndex = token.indexOf('=');
      const optName = eqIndex > 0 ? token.slice(0, eqIndex) : token;

      // アクティブなコマンド（サブコマンドがあればそちらを優先）
      const activeCommand = context.subcommand || context.command;
      const option = findOption(activeCommand, optName);

      if (option) {
        // -r/--remote フラグを追跡
        if (option.names.includes('-r') || option.names.includes('--remote')) {
          context.hasRemoteFlag = true;
        }

        if (option.takesValue) {
          if (eqIndex > 0) {
            // --option=value 形式 → 値まで入力済み
            context.completedOptions.push(...option.names);
          } else if (isCurrentToken) {
            // オプション自体を補完中
            context.cursorPosition = 'option';
            return context;
          } else {
            // 次のトークンが値
            pendingOptionForValue = option;
          }
        } else {
          // フラグオプション
          context.completedOptions.push(...option.names);
        }
      }
      tokenIndex++;
      continue;
    }

    // 位置引数の場合
    if (!isCurrentToken) {
      context.positionalArgs.push(token);
    }
    tokenIndex++;
  }

  // 最終的なカーソル位置を決定
  if (cword >= tokens.length || tokens[cword] === '') {
    // 新しいトークンを開始
    if (pendingOptionForValue) {
      context.currentOptionNeedingValue = pendingOptionForValue;
      context.cursorPosition = 'optionValue';
    } else if (
      context.command?.subcommands &&
      context.command.subcommands.length > 0 &&
      !context.subcommand
    ) {
      // サブコマンドを持つコマンドで、まだサブコマンドが確定していない場合
      context.cursorPosition = 'subcommand';
    } else {
      // 位置引数かオプションか判定
      const activeCommand = context.subcommand || context.command;
      if (activeCommand?.args && activeCommand.args.length > 0) {
        const argIndex = context.positionalArgs.length;
        if (argIndex < activeCommand.args.length) {
          context.cursorPosition = 'positional';
        } else {
          context.cursorPosition = 'option';
        }
      } else {
        context.cursorPosition = 'option';
      }
    }
  } else {
    const currentToken = tokens[cword];
    if (isOptionLike(currentToken)) {
      context.cursorPosition = 'option';
    } else if (cword === 0) {
      context.cursorPosition = 'subcommand';
    } else if (
      context.command?.subcommands &&
      !context.subcommand &&
      cword === 1
    ) {
      context.cursorPosition = 'subcommand';
    } else {
      context.cursorPosition = 'positional';
    }
  }

  return context;
}

/**
 * アクティブなコマンドを取得（サブコマンドがあればそちらを優先）
 */
export function getActiveCommand(
  context: ParsedContext
): CompletionCommand | undefined {
  return context.subcommand || context.command;
}
