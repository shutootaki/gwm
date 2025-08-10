import { execSync } from 'child_process';
import { escapeShellArg, execAsync } from '../shell.js';

/**
 * Gitリポジトリかどうかをチェックする
 */
export function isGitRepository(): boolean {
  try {
    execSync('git rev-parse --git-dir', {
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
export async function fetchAndPrune(): Promise<void> {
  try {
    await execAsync('git fetch --prune origin', {
      cwd: process.cwd(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);

    if (/No such remote ['"]?origin['"]?/.test(message)) {
      throw new Error(
        'No remote named "origin" found. Please configure a remote repository.'
      );
    }

    throw new Error(`Failed to fetch and prune from remote: ${message}`);
  }
}

/**
 * worktreeを削除する
 */
export async function removeWorktree(
  path: string,
  force: boolean = false
): Promise<void> {
  try {
    const forceFlag = force ? ' --force' : '';
    await execAsync(`git worktree remove ${escapeShellArg(path)}${forceFlag}`, {
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
    console.warn(
      'Could not get repository name from remote, falling back to directory name'
    );
  }

  return process.cwd().split('/').pop() || 'unknown';
}

/**
 * ローカルブランチが存在するか確認
 */
export function localBranchExists(branch: string): boolean {
  try {
    execSync(
      `git show-ref --verify --quiet refs/heads/${escapeShellArg(branch)}`,
      {
        stdio: 'ignore',
        cwd: process.cwd(),
      }
    );
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
      execSync(
        `git show-ref --verify --quiet refs/remotes/origin/${escapeShellArg(branch)}`,
        {
          stdio: 'ignore',
          cwd: process.cwd(),
        }
      );
    } catch {
      // upstream がない = 既に削除 or push していない -> 安全のため未マージと判定しない
      return false;
    }

    const output = execSync(
      `git cherry origin/${escapeShellArg(branch)} ${escapeShellArg(branch)}`,
      {
        encoding: 'utf8',
        cwd: process.cwd(),
      }
    ).trim();

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
    execSync(`git branch ${flag} ${escapeShellArg(branch)}`, {
      stdio: 'ignore',
      cwd: process.cwd(),
    });
  } catch (err) {
    throw new Error(
      `Failed to delete branch ${branch}: ${err instanceof Error ? err.message : String(err)}`
    );
  }
}

/**
 * リポジトリのルートディレクトリを取得
 */
export function getRepoRoot(): string {
  try {
    return execSync('git rev-parse --show-toplevel', {
      cwd: process.cwd(),
      encoding: 'utf8',
    }).trim();
  } catch {
    return process.cwd();
  }
}
