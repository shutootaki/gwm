/**
 * __complete の本体（候補生成）
 * シェル補完から呼び出される
 */

import type { ShellType } from '../types.js';
import { completionDefinition } from '../definition.js';
import { parseTokens, getActiveCommand, type ParsedContext } from './parser.js';
import {
  getProviderCandidates,
  type CompletionCandidate,
} from '../providers/index.js';

/**
 * 候補を生成
 * @param tokens トークン列（gwm 自体は除く）
 * @param cword 現在補完中のトークンインデックス
 * @param shell シェルの種類
 * @returns 候補文字列（1行1候補、タブ区切りで説明）
 */
export async function generateCandidates(
  tokens: string[],
  cword: number,
  shell: ShellType
): Promise<string> {
  const context = parseTokens(tokens, cword);
  const candidates: CompletionCandidate[] = [];

  switch (context.cursorPosition) {
    case 'subcommand':
      await collectSubcommandCandidates(context, candidates);
      break;

    case 'option':
      collectOptionCandidates(context, candidates);
      break;

    case 'optionValue':
      await collectOptionValueCandidates(context, candidates);
      break;

    case 'positional':
      await collectPositionalCandidates(context, candidates);
      break;
  }

  // プレフィックスでフィルタリング
  const prefix = context.currentToken.toLowerCase();
  const filtered = candidates.filter((c) =>
    c.value.toLowerCase().startsWith(prefix)
  );

  // 出力フォーマット
  return formatCandidates(filtered, shell);
}

/**
 * サブコマンド候補を収集
 */
async function collectSubcommandCandidates(
  context: ParsedContext,
  candidates: CompletionCandidate[]
): Promise<void> {
  // completion コマンドのサブコマンド
  if (context.command?.name === 'completion' && !context.subcommand) {
    for (const sub of context.command.subcommands || []) {
      if (!sub.hidden) {
        candidates.push({
          value: sub.name,
          description: sub.description,
        });
      }
    }
    return;
  }

  // トップレベルのサブコマンド
  for (const cmd of completionDefinition.commands) {
    if (cmd.hidden) continue;
    candidates.push({
      value: cmd.name,
      description: cmd.description,
    });
    // 別名も追加
    for (const alias of cmd.aliases || []) {
      candidates.push({
        value: alias,
        description: cmd.description,
      });
    }
  }
}

/**
 * オプション候補を収集
 */
function collectOptionCandidates(
  context: ParsedContext,
  candidates: CompletionCandidate[]
): void {
  const activeCommand = getActiveCommand(context);
  if (!activeCommand?.options) {
    return;
  }

  for (const opt of activeCommand.options) {
    for (const name of opt.names) {
      // 既に使用済みのオプションはスキップ
      if (context.completedOptions.includes(name)) {
        continue;
      }
      candidates.push({
        value: name,
        description: opt.description,
      });
    }
  }

  // グローバルオプションも追加
  for (const opt of completionDefinition.globalOptions || []) {
    for (const name of opt.names) {
      if (context.completedOptions.includes(name)) {
        continue;
      }
      candidates.push({
        value: name,
        description: opt.description,
      });
    }
  }
}

/**
 * 引数定義から候補を収集する共通ヘルパー
 */
async function collectCandidatesFromArg(
  arg: {
    staticValues?: string[];
    providers?: Parameters<typeof getProviderCandidates>[0][];
  },
  candidates: CompletionCandidate[]
): Promise<void> {
  if (arg.staticValues) {
    candidates.push(...arg.staticValues.map((val) => ({ value: val })));
    return;
  }
  if (arg.providers) {
    const results = await Promise.all(arg.providers.map(getProviderCandidates));
    candidates.push(...results.flat());
  }
}

/**
 * オプション値候補を収集
 */
async function collectOptionValueCandidates(
  context: ParsedContext,
  candidates: CompletionCandidate[]
): Promise<void> {
  const arg = context.currentOptionNeedingValue?.valueArg;
  if (arg) await collectCandidatesFromArg(arg, candidates);
}

/**
 * 位置引数候補を収集
 */
async function collectPositionalCandidates(
  context: ParsedContext,
  candidates: CompletionCandidate[]
): Promise<void> {
  const activeCommand = getActiveCommand(context);
  const argIndex = context.positionalArgs.length;
  const arg = activeCommand?.args?.[argIndex];

  if (arg) {
    await collectCandidatesFromArg(arg, candidates);
  } else if (activeCommand?.name === 'add' && context.hasRemoteFlag) {
    // add コマンドで -r/--remote が指定されている場合はリモートブランチを候補に
    candidates.push(...(await getProviderCandidates('remoteBranchesOrigin')));
  }
}

/**
 * 候補をフォーマット
 * @param candidates 候補リスト
 * @param _shell シェルの種類（将来のシェル固有フォーマット対応用に予約）
 */
function formatCandidates(
  candidates: CompletionCandidate[],
  _shell: ShellType
): string {
  // 重複除去しつつフォーマット（"value\tdescription" 形式）
  const seen = new Set<string>();
  return candidates
    .filter((c) => !seen.has(c.value) && seen.add(c.value))
    .map((c) => (c.description ? `${c.value}\t${c.description}` : c.value))
    .join('\n');
}

/**
 * __complete コマンドのエントリーポイント
 */
export async function runComplete(
  shell: ShellType,
  cword: number,
  tokens: string[]
): Promise<void> {
  try {
    const output = await generateCandidates(tokens, cword, shell);
    if (output) {
      process.stdout.write(output + '\n');
    }
  } catch {
    // エラー時は何も出力しない（補完が壊れないように）
    process.exit(0);
  }
}
