import { execSync } from 'child_process';
import { escapeShellArg, execAsync } from '../shell.js';
import type { RemoteBranchInfo, RemoteBranchStatus } from './types.js';

/**
 * リモートブランチの状態を確認
 * - isDeleted: origin/<branch> が存在しない
 * - isMerged : ブランチがいずれかの mainBranch にマージ済み
 */
export function checkRemoteBranchStatus(
  branch: string,
  mainBranches: string[]
): RemoteBranchStatus {
  // sanitize branch (refs/heads/... を取り除く)
  const branchName = branch.replace(/^refs\/heads\//, '');
  let isDeleted = false;
  let isMerged = false;
  let mergedIntoBranch: string | undefined;

  // リモートブランチの存在は fetch/prune 済みのローカル追跡リファレンスを確認する
  // ネットワークアクセスを伴う `git ls-remote` はコストが高いため使用しない。
  try {
    execSync(
      `git show-ref --verify --quiet refs/remotes/origin/${escapeShellArg(branchName)}`,
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
          `git merge-base --is-ancestor origin/${escapeShellArg(branchName)} origin/${escapeShellArg(mainBr)}`,
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
 * リモートブランチの詳細情報を取得する
 */
export async function getRemoteBranchesWithInfo(): Promise<RemoteBranchInfo[]> {
  try {
    // git for-each-ref でリモートブランチの詳細情報を取得
    const { stdout } = await execAsync(
      'git for-each-ref refs/remotes --format="%(refname:short)|%(committerdate:iso8601-strict)|%(committername)|%(subject)"',
      {
        cwd: process.cwd(),
        encoding: 'utf8',
      }
    );

    const branches = stdout
      .split('\n')
      .filter((line) => line.trim() && !line.includes('HEAD'))
      .map((line) => {
        const [fullName, date, committer, subject] = line.split('|');
        const name = fullName.replace('origin/', '');

        return {
          name,
          fullName,
          lastCommitDate: date || '',
          lastCommitterName: committer || '',
          lastCommitMessage: subject || '',
        };
      });

    return branches;
  } catch (err) {
    throw new Error(
      `Failed to get remote branches: ${err instanceof Error ? err.message : 'Unknown error'}`
    );
  }
}
