import { execSync } from 'child_process';
import { loadConfig } from '../config.js';

export interface Worktree {
  path: string;
  branch: string;
  head: string;
  status: string;
  isActive: boolean;
  isMain: boolean;
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
        if (!currentWorktree.branch) currentWorktree.branch = '(detached)';
        if (!currentWorktree.head) currentWorktree.head = 'UNKNOWN';
        worktrees.push(currentWorktree as Worktree);
      }
      currentWorktree = {
        path: line.substring(9),
        status: 'OTHER',
        isActive: false,
        isMain: false,
      };
    } else if (line.startsWith('HEAD ')) {
      currentWorktree.head = line.substring(5);
    } else if (line.startsWith('branch ')) {
      currentWorktree.branch = line.substring(7);
    } else if (line === 'bare') {
      currentWorktree.branch = '(bare)';
      currentWorktree.isMain = true;
      currentWorktree.status = 'MAIN';
    } else if (line === 'detached') {
      currentWorktree.branch = '(detached)';
    } else if (line === 'locked') {
      // lockedの情報は保持するが、ステータスは変更しない
    }
  }

  if (currentWorktree.path) {
    // フィールドのフォールバック値を付与
    if (!currentWorktree.branch) currentWorktree.branch = '(detached)';
    if (!currentWorktree.head) currentWorktree.head = 'UNKNOWN';
    worktrees.push(currentWorktree as Worktree);
  }

  // 最初のworktreeをメインとしてマーク（通常の場合）
  if (worktrees.length > 0 && !worktrees.some((w) => w.isMain)) {
    worktrees[0].isMain = true;
    worktrees[0].status = 'MAIN';
  }

  // 現在のディレクトリと一致するworktreeをACTIVEにする
  const currentDir = process.cwd();
  worktrees.forEach((worktree) => {
    if (worktree.path === currentDir) {
      worktree.isActive = true;
      worktree.status = 'ACTIVE';
    }
  });

  return worktrees;
}

/**
 * worktreeのリストを取得し、PRUNABLE状態を判定する
 */
export async function getWorktreesWithStatus(): Promise<Worktree[]> {
  try {
    // Gitリポジトリかどうかチェック
    try {
      execSync('git rev-parse --git-dir', {
        stdio: 'ignore',
        cwd: process.cwd(),
      });
    } catch {
      throw new Error(
        'Not a git repository. Please run this command from within a git repository.'
      );
    }

    const output = execSync('git worktree list --porcelain', {
      encoding: 'utf8',
      cwd: process.cwd(),
    });

    const worktrees = parseWorktrees(output);

    return worktrees;
  } catch (err) {
    if (err instanceof Error) {
      throw err; // 既に適切なメッセージがある場合はそのまま
    }
    throw new Error(`Failed to get worktrees: ${err}`);
  }
}

/**
 * git fetch --prune origin を実行
 */
export function fetchAndPrune(): void {
  try {
    // origin を前提として fetch --prune を試みる
    execSync('git fetch --prune origin', {
      stdio: 'ignore',
      cwd: process.cwd(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);

    // origin が存在しない場合はユーザーフレンドリなメッセージを返す
    if (/No such remote ['"]?origin['"]?/.test(message)) {
      throw new Error(
        'No remote named "origin" found. Please configure a remote repository.'
      );
    }

    // それ以外のエラーは共通メッセージにラップ
    throw new Error(`Failed to fetch and prune from remote: ${message}`);
  }
}

/**
 * worktreeを削除する
 */
export function removeWorktree(path: string, force: boolean = false): void {
  // シェルエスケープ簡易実装（ダブルクォート & バックスラッシュ をエスケープ）
  const escapedPath = `"${path.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;

  try {
    const forceFlag = force ? ' --force' : '';
    execSync(`git worktree remove ${escapedPath}${forceFlag}`, {
      cwd: process.cwd(),
    });
  } catch (err) {
    throw new Error(
      `Failed to remove worktree ${path}: ${err instanceof Error ? err.message : 'Unknown error'}`
    );
  }
}

/**
 * Gitリポジトリ名を取得する
 * リモートのorigin URLからリポジトリ名を抽出する
 * フォールバックとして現在のディレクトリ名を使用する
 */
export function getRepositoryName(): string {
  try {
    const remoteUrl = execSync('git remote get-url origin', {
      cwd: process.cwd(),
      encoding: 'utf8',
    }).trim();

    // GitHubのURLからリポジトリ名を抽出
    // HTTPS: https://github.com/user/repo.git
    // SSH: git@github.com:user/repo.git
    const match = remoteUrl.match(/\/([^/]+?)(?:\.git)?$/);
    if (match && match[1]) {
      return match[1];
    }
  } catch {
    // リモートが存在しない場合やエラーの場合はフォールバック
    console.warn(
      'Could not get repository name from remote, falling back to directory name'
    );
  }

  // フォールバック: 現在のディレクトリ名を使用
  return process.cwd().split('/').pop() || 'unknown';
}

export interface PullResult {
  branch: string;
  path: string;
  success: boolean;
  message: string;
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
 * ローカルブランチが存在するか確認
 */
export function localBranchExists(branch: string): boolean {
  try {
    execSync(`git show-ref --verify --quiet refs/heads/${branch}`, {
      stdio: 'ignore',
      cwd: process.cwd(),
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * ブランチに未マージコミットがあるかを簡易判定
 * origin/<branch> が存在する場合に限り git cherry で差分を確認。
 * 取得に失敗した場合は true を返し、安全側で未マージとみなす。
 */
export function hasUnmergedCommits(branch: string): boolean {
  try {
    // origin/<branch> が無い場合は fetch を試みない
    try {
      execSync(`git show-ref --verify --quiet refs/remotes/origin/${branch}`, {
        stdio: 'ignore',
        cwd: process.cwd(),
      });
    } catch {
      // upstream がない = 既に削除 or push していない -> 安全のため未マージと判定しない
      return false;
    }

    const output = execSync(`git cherry origin/${branch} ${branch}`, {
      encoding: 'utf8',
      cwd: process.cwd(),
    }).trim();

    return output.length > 0;
  } catch {
    // 何らかのエラー時は安全側で未マージと見なす
    return true;
  }
}

/**
 * ローカルブランチを削除する (未マージコミットがある場合は -D を要求)
 */
export function deleteLocalBranch(
  branch: string,
  force: boolean = false
): void {
  try {
    const flag = force ? '-D' : '-d';
    execSync(`git branch ${flag} ${branch}`, {
      stdio: 'ignore',
      cwd: process.cwd(),
    });
  } catch (err) {
    throw new Error(
      `Failed to delete branch ${branch}: ${err instanceof Error ? err.message : String(err)}`
    );
  }
}

export interface CleanableWorktree {
  worktree: Worktree;
  reason: 'remote_deleted' | 'merged';
  mergedIntoBranch?: string;
}

/**
 * リモートブランチの状態を確認
 * - isDeleted: origin/<branch> が存在しない
 * - isMerged : ブランチがいずれかの mainBranch にマージ済み
 */
export function checkRemoteBranchStatus(
  branch: string,
  mainBranches: string[]
): {
  isDeleted: boolean;
  isMerged: boolean;
  mergedIntoBranch?: string;
} {
  // sanitize branch (refs/heads/... を取り除く)
  const branchName = branch.replace(/^refs\/heads\//, '');
  let isDeleted = false;
  let isMerged = false;
  let mergedIntoBranch: string | undefined;

  // リモートブランチの存在は fetch/prune 済みのローカル追跡リファレンスを確認する
  // ネットワークアクセスを伴う `git ls-remote` はコストが高いため使用しない。
  try {
    execSync(
      `git show-ref --verify --quiet refs/remotes/origin/${branchName}`,
      {
        cwd: process.cwd(),
        stdio: 'ignore',
      }
    );
    // 参照が見つかった = ブランチは存在
  } catch {
    // 参照が無い = origin にブランチが存在しない（削除済み）
    isDeleted = true;
  }

  // マージ判定 (origin にブランチがある場合のみチェック)
  if (!isDeleted) {
    for (const mainBr of mainBranches) {
      try {
        execSync(
          `git merge-base --is-ancestor origin/${branchName} origin/${mainBr}`,
          { cwd: process.cwd(), stdio: 'ignore' }
        );
        // exit code 0 なら ancestor
        isMerged = true;
        mergedIntoBranch = mainBr;
        break;
      } catch {
        // exit code 1 -> not ancestor, その他 -> 無視
        continue;
      }
    }
  }

  return { isDeleted, isMerged, mergedIntoBranch };
}

/**
 * ワークツリーパスでローカル変更を確認
 */
export function checkLocalChanges(worktreePath: string): {
  hasUnstagedChanges: boolean;
  hasUntrackedFiles: boolean;
  hasStagedChanges: boolean;
  hasLocalCommits: boolean;
} {
  let statusLines: string[] = [];
  try {
    const output = execSync('git status --porcelain', {
      cwd: worktreePath,
      encoding: 'utf8',
    });
    statusLines = output.split('\n').filter((l) => l.trim() !== '');
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
    execSync('git rev-parse --abbrev-ref --symbolic-full-name @{u}', {
      cwd: worktreePath,
      stdio: 'ignore',
    });

    const cherry = execSync('git cherry -v', {
      cwd: worktreePath,
      encoding: 'utf8',
    }).trim();
    if (cherry.length > 0) hasLocalCommits = true;
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
    const local = checkLocalChanges(wt.path);
    const hasChanges =
      local.hasLocalCommits ||
      local.hasStagedChanges ||
      local.hasUnstagedChanges ||
      local.hasUntrackedFiles;
    if (hasChanges) continue;

    results.push({
      worktree: wt,
      reason: isDeleted ? 'remote_deleted' : 'merged',
      mergedIntoBranch,
    });
  }

  return results;
}

export function getRepoRoot(): string {
  try {
    return execSync('git rev-parse --show-toplevel', {
      cwd: process.cwd(),
      encoding: 'utf8',
    }).trim();
  } catch {
    // 取得できない場合はカレントディレクトリを返す
    return process.cwd();
  }
}
