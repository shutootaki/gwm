import { execSync } from 'child_process';
import { loadConfig } from '../config.js';

export interface Worktree {
  path: string;
  branch: string;
  head: string;
  status: 'ACTIVE' | 'NORMAL' | 'PRUNABLE' | 'LOCKED';
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
        status: 'NORMAL',
        isActive: false,
        isMain: false,
      };
    } else if (line.startsWith('HEAD ')) {
      currentWorktree.head = line.substring(5);
    } else if (line.startsWith('branch ')) {
      currentWorktree.branch = line.substring(7);
    } else if (line === 'bare') {
      currentWorktree.branch = '(bare)';
      currentWorktree.isMain = true; // bare repositoryは通常メイン
    } else if (line === 'detached') {
      currentWorktree.branch = '(detached)';
    } else if (line === 'locked') {
      if (currentWorktree.status !== 'ACTIVE') {
        currentWorktree.status = 'LOCKED';
      }
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

    // PRUNABLE状態を判定
    for (const worktree of worktrees) {
      if (
        worktree.status === 'LOCKED' ||
        worktree.status === 'ACTIVE' ||
        worktree.isMain
      ) {
        continue; // LOCKEDやACTIVE、メインworktreeはスキップ
      }

      if (await isPrunableWorktree(worktree)) {
        worktree.status = 'PRUNABLE';
      }
    }

    return worktrees;
  } catch (err) {
    if (err instanceof Error) {
      throw err; // 既に適切なメッセージがある場合はそのまま
    }
    throw new Error(`Failed to get worktrees: ${err}`);
  }
}

/**
 * worktreeが削除可能（PRUNABLE）かどうかを判定する
 */
async function isPrunableWorktree(worktree: Worktree): Promise<boolean> {
  if (worktree.branch === '(bare)' || worktree.branch === '(detached)') {
    return false;
  }

  try {
    const config = loadConfig();
    const mainBranches = config.main_branches;

    // リモート追跡ブランチが存在しない場合はPRUNABLE
    if (!hasRemoteTrackingBranch(worktree.branch)) {
      return true;
    }

    // メインブランチにマージ済みかチェック
    for (const mainBranch of mainBranches) {
      if (isMergedToMainBranch(worktree.branch, mainBranch)) {
        return true;
      }
    }

    return false;
  } catch (err) {
    console.error(
      `Error checking prunable status for ${worktree.branch}:`,
      err
    );
    return false;
  }
}

/**
 * リモート追跡ブランチが存在するかチェック
 */
function hasRemoteTrackingBranch(branchName: string): boolean {
  try {
    const remotesOutput = execSync('git remote', {
      encoding: 'utf8',
      cwd: process.cwd(),
    }).trim();

    // リモートが 0 件の場合でも origin を仮定して確認する
    const remotes = remotesOutput
      ? remotesOutput
          .split('\n')
          .map((r) => r.trim())
          .filter(Boolean)
      : ['origin'];

    // refs/heads/ を取り除いた短いブランチ名を使用する
    const shortName = branchName.replace(/^refs\/heads\//, '');

    for (const remote of remotes) {
      try {
        execSync(
          `git show-ref --verify --quiet refs/remotes/${remote}/${shortName}`,
          {
            stdio: 'ignore',
            cwd: process.cwd(),
          }
        );
        return true; // 見つかった
      } catch {
        // continue
      }
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * ブランチがメインブランチにマージ済みかチェック
 */
function isMergedToMainBranch(branchName: string, mainBranch: string): boolean {
  try {
    execSync(`git merge-base --is-ancestor ${branchName} ${mainBranch}`, {
      stdio: 'ignore',
      cwd: process.cwd(),
    });
    return true;
  } catch {
    return false;
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
