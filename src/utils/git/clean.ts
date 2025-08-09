import { execAsync } from '../shell.js';
import { loadConfig } from '../../config.js';
import { getWorktreesWithStatus } from './worktree.js';
import { checkRemoteBranchStatus } from './remote.js';
import type { LocalChanges, CleanableWorktree } from './types.js';

/**
 * ワークツリーパスでローカル変更を確認
 */
export async function checkLocalChanges(
  worktreePath: string
): Promise<LocalChanges> {
  let statusLines: string[] = [];
  try {
    const { stdout } = await execAsync('git status --porcelain', {
      cwd: worktreePath,
      encoding: 'utf8',
    });
    statusLines = stdout.split('\n').filter((l) => l.trim() !== '');
  } catch {
    // ignore, treat as no changes
  }

  let hasUnstagedChanges = false;
  let hasUntrackedFiles = false;
  let hasStagedChanges = false;

  statusLines.forEach((line) => {
    if (line.startsWith('??')) hasUntrackedFiles = true;
    else {
      const [x, y] = line.split('');
      if (x && x !== ' ') hasStagedChanges = true;
      if (y && y !== ' ') hasUnstagedChanges = true;
    }
  });

  // 未プッシュコミット
  let hasLocalCommits = false;
  try {
    // upstream が無い場合エラーになる
    await execAsync('git rev-parse --abbrev-ref --symbolic-full-name @{u}', {
      cwd: worktreePath,
    });

    const { stdout: cherryOut } = await execAsync('git cherry -v', {
      cwd: worktreePath,
      encoding: 'utf8',
    });
    if (cherryOut.trim().length > 0) hasLocalCommits = true;
  } catch {
    // upstreamが無い -> リモートに存在しない or 削除済み。未プッシュコミットは無視
    hasLocalCommits = false;
  }

  return {
    hasUnstagedChanges,
    hasUntrackedFiles,
    hasStagedChanges,
    hasLocalCommits,
  };
}

/**
 * ローカル変更があるかどうかを判定
 */
function hasAnyLocalChanges(changes: LocalChanges): boolean {
  return (
    changes.hasLocalCommits ||
    changes.hasStagedChanges ||
    changes.hasUnstagedChanges ||
    changes.hasUntrackedFiles
  );
}

/**
 * 削除可能なワークツリーを取得
 */
export async function getCleanableWorktrees(): Promise<CleanableWorktree[]> {
  const config = loadConfig();
  const worktrees = await getWorktreesWithStatus();

  const results: CleanableWorktree[] = [];

  for (const wt of worktrees) {
    // MAIN / ACTIVE を除外
    if (wt.isMain || wt.isActive) continue;

    const { isDeleted, isMerged, mergedIntoBranch } = checkRemoteBranchStatus(
      wt.branch,
      config.main_branches
    );

    // 1. リモート削除 または マージ済み
    if (!isDeleted && !isMerged) continue;

    // 2. ローカル変更なし
    const local = await checkLocalChanges(wt.path);
    if (hasAnyLocalChanges(local)) continue;

    results.push({
      worktree: wt,
      reason: isDeleted ? 'remote_deleted' : 'merged',
      mergedIntoBranch,
    });
  }

  return results;
}
