/**
 * 内部コマンド（__complete, __fig_* 等）
 * React を使わず直接 stdout に出力
 */

import type { ShellType } from '../types.js';
import type { CompletionCandidate } from '../providers/types.js';
import { runComplete } from '../runtime/complete.js';
import { getWorktreeCandidates } from '../providers/worktrees.js';
import { getLocalBranchCandidates } from '../providers/branches-local.js';
import { getRemoteBranchCandidates } from '../providers/branches-remote.js';

/**
 * 候補を Fig 形式で stdout に出力
 */
async function outputFigCandidates(
  getCandidates: () => Promise<CompletionCandidate[]>
): Promise<void> {
  try {
    const candidates = await getCandidates();
    for (const c of candidates) {
      process.stdout.write(
        c.description ? `${c.value}\t${c.description}\n` : `${c.value}\n`
      );
    }
  } catch {
    // エラー時は何も出力しない
  }
}

/**
 * 引数をパースしてshellタイプとcwordを取得
 */
function parseInternalArgs(args: string[]): {
  shell: ShellType;
  cword: number;
  tokens: string[];
} {
  let shell: ShellType = 'bash';
  let cword = 0;
  let tokens: string[] = [];
  let foundDoubleDash = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (foundDoubleDash) {
      tokens.push(arg);
      continue;
    }

    if (arg === '--') {
      foundDoubleDash = true;
      continue;
    }

    if (arg === '--shell' && i + 1 < args.length) {
      const nextArg = args[++i];
      if (nextArg === 'bash' || nextArg === 'zsh' || nextArg === 'fish') {
        shell = nextArg;
      }
      continue;
    }

    if (arg === '--cword' && i + 1 < args.length) {
      cword = parseInt(args[++i], 10);
      if (isNaN(cword)) {
        cword = 0;
      }
      continue;
    }
  }

  return { shell, cword, tokens };
}

/**
 * __complete コマンドを実行
 */
export async function runInternalComplete(args: string[]): Promise<void> {
  const { shell, cword, tokens } = parseInternalArgs(args);
  await runComplete(shell, cword, tokens);
}

/** 内部コマンドのマップ */
const internalCommands: Record<string, (args: string[]) => Promise<void>> = {
  __complete: runInternalComplete,
  __fig_worktrees: () => outputFigCandidates(getWorktreeCandidates),
  __fig_branches_local: () => outputFigCandidates(getLocalBranchCandidates),
  __fig_branches_remote: () => outputFigCandidates(getRemoteBranchCandidates),
};

/**
 * 内部コマンドを実行
 * @returns true: 内部コマンドとして処理した, false: 処理しなかった
 */
export async function runInternalCommand(
  subCommand: string,
  args: string[]
): Promise<boolean> {
  const handler = internalCommands[subCommand];
  if (handler) {
    await handler(args);
    return true;
  }
  return false;
}
