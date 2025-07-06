import { execSync } from 'child_process';
import { loadConfig } from '../../config.js';
import { isGitRepository } from './core.js';
import type { Worktree, PullResult } from './types.js';

/**
 * worktreeエントリを処理する
 */
function processWorktreeEntry(
  line: string,
  currentWorktree: Partial<Worktree>
): void {
  if (line.startsWith('HEAD ')) {
    currentWorktree.head = line.substring(5);
  } else if (line.startsWith('branch ')) {
    currentWorktree.branch = line.substring(7);
  } else if (line === 'bare') {
    currentWorktree.branch = '(bare)';
    currentWorktree.isMain = true;
    currentWorktree.status = 'MAIN';
  } else if (line === 'detached') {
    currentWorktree.branch = '(detached)';
  }
}

/**
 * worktreeエントリを完成させる
 */
function finalizeWorktreeEntry(currentWorktree: Partial<Worktree>): Worktree {
  if (!currentWorktree.branch) currentWorktree.branch = '(detached)';
  if (!currentWorktree.head) currentWorktree.head = 'UNKNOWN';
  return currentWorktree as Worktree;
}

/**
 * アクティブworktreeを設定する
 */
function setActiveWorktree(worktrees: Worktree[]): void {
  const currentDir = process.cwd();
  worktrees.forEach((worktree) => {
    if (worktree.path === currentDir) {
      worktree.isActive = true;
      worktree.status = 'ACTIVE';
    }
  });
}

/**
 * メインworktreeを設定する
 */
function setMainWorktree(worktrees: Worktree[]): void {
  if (worktrees.length > 0 && !worktrees.some((w) => w.isMain)) {
    worktrees[0].isMain = true;
    worktrees[0].status = 'MAIN';
  }
}

/**
 * git worktree list --porcelain の出力をパースする
 */
export function parseWorktrees(output: string): Worktree[] {
  const lines = output.trim().split('\n');
  const worktrees: Worktree[] = [];
  let currentWorktree: Partial<Worktree> = {};

  for (const line of lines) {
    if (line.startsWith('worktree ')) {
      if (currentWorktree.path) {
        worktrees.push(finalizeWorktreeEntry(currentWorktree));
      }
      currentWorktree = {
        path: line.substring(9),
        status: 'OTHER',
        isActive: false,
        isMain: false,
      };
    } else if (line === 'locked') {
      // lockedの情報は保持するが、ステータスは変更しない
    } else {
      processWorktreeEntry(line, currentWorktree);
    }
  }

  if (currentWorktree.path) {
    worktrees.push(finalizeWorktreeEntry(currentWorktree));
  }

  setMainWorktree(worktrees);
  setActiveWorktree(worktrees);

  return worktrees;
}

/**
 * worktreeのリストを取得し、PRUNABLE状態を判定する
 */
export async function getWorktreesWithStatus(): Promise<Worktree[]> {
  try {
    if (!isGitRepository()) {
      throw new Error(
        'Not a git repository. Please run this command from within a git repository.'
      );
    }

    const output = execSync('git worktree list --porcelain', {
      encoding: 'utf8',
      cwd: process.cwd(),
    });

    return parseWorktrees(output);
  } catch (err) {
    if (err instanceof Error) {
      throw err;
    }
    throw new Error(`Failed to get worktrees: ${err}`);
  }
}

/**
 * メインブランチ（複数可）のworktreeでgit pullを実行する
 */
export async function pullMainBranch(): Promise<PullResult[]> {
  try {
    const config = loadConfig();
    const worktrees = await getWorktreesWithStatus();
    const results: PullResult[] = [];

    // メインブランチに該当するworktreeを特定
    const mainWorktrees = worktrees.filter((worktree) =>
      config.main_branches.some(
        (mainBranch) =>
          worktree.branch === mainBranch ||
          worktree.branch === `refs/heads/${mainBranch}`
      )
    );

    if (mainWorktrees.length === 0) {
      throw new Error(
        `No worktrees found for main branches: ${config.main_branches.join(', ')}`
      );
    }

    // 各メインワークツリーでpullを実行
    for (const worktree of mainWorktrees) {
      try {
        const output = execSync('git pull', {
          cwd: worktree.path,
          encoding: 'utf8',
        });

        results.push({
          branch: worktree.branch,
          path: worktree.path,
          success: true,
          message: output.trim(),
        });
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        results.push({
          branch: worktree.branch,
          path: worktree.path,
          success: false,
          message: `Failed to pull: ${errorMessage}`,
        });
      }
    }

    return results;
  } catch (err) {
    throw new Error(
      `Failed to pull main branches: ${err instanceof Error ? err.message : 'Unknown error'}`
    );
  }
}

/**
 * メインワークツリーのパスを取得する
 * 通常、最初のワークツリーがメインとなる
 */
export function getMainWorktreePath(): string | null {
  try {
    const worktrees = parseWorktrees(
      execSync('git worktree list --porcelain', {
        encoding: 'utf8',
        cwd: process.cwd(),
      })
    );

    // isMainフラグが設定されているワークツリーを探す
    const mainWorktree = worktrees.find((wt) => wt.isMain);
    if (mainWorktree) {
      return mainWorktree.path;
    }

    // フォールバック: 最初のワークツリーをメインとして扱う
    if (worktrees.length > 0) {
      return worktrees[0].path;
    }

    return null;
  } catch {
    return null;
  }
}
