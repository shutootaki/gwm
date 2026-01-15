import { execSync } from 'child_process';
import { existsSync, readdirSync, statSync } from 'fs';
import { join, dirname, relative, resolve } from 'path';
import { loadConfig } from '../config.js';
import { escapeShellArg, execAsync } from './shell.js';
import { isVirtualEnv } from './virtualenv.js';

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
      await execAsync('git rev-parse --git-dir', {
        cwd: process.cwd(),
      });
    } catch {
      throw new Error(
        'Not a git repository. Please run this command from within a git repository.'
      );
    }

    const { stdout } = await execAsync('git worktree list --porcelain', {
      encoding: 'utf8',
      cwd: process.cwd(),
    });

    const worktrees = parseWorktrees(stdout);

    return worktrees;
  } catch (err) {
    if (err instanceof Error) {
      throw err; // 既に適切なメッセージがある場合はそのまま
    }
    throw new Error(`Failed to get worktrees: ${err}`);
  }
}

/**
 * git fetch --prune origin を実行（非同期版）
 */
export async function fetchAndPrune(): Promise<void> {
  try {
    // origin を前提として fetch --prune を試みる
    await execAsync('git fetch --prune origin', {
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
 * worktreeを削除する（非同期版）
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
 * ローカルブランチを削除する (未マージコミットがある場合は -D を要求)（非同期版）
 */
export async function deleteLocalBranch(
  branch: string,
  force: boolean = false
): Promise<void> {
  try {
    const flag = force ? '-D' : '-d';
    await execAsync(`git branch ${flag} ${escapeShellArg(branch)}`, {
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

export interface RemoteBranchInfo {
  name: string;
  fullName: string;
  lastCommitDate: string;
  lastCommitterName: string;
  lastCommitMessage: string;
}

/**
 * リモートブランチの詳細情報を取得する（非同期版）
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

/**
 * gitignoreされたファイルのリストを取得
 * @param workdir 検索対象のディレクトリ
 * @param patterns 検索パターン（ワイルドカード対応）
 * @param excludePatterns 除外パターン
 */
export function getIgnoredFiles(
  workdir: string,
  patterns: string[],
  excludePatterns?: string[],
  /**
   * 仮想環境ディレクトリをスキップするかどうか。
   * true  : isVirtualEnv() に一致したディレクトリを走査対象から除外 (既定)
   * false : 仮想環境も通常ディレクトリとして扱う
   */
  skipVirtualEnvs: boolean = true
): string[] {
  // patterns も excludePatterns も両方空の場合は何もコピーしない
  const hasExcludePatterns = excludePatterns && excludePatterns.length > 0;
  if (patterns.length === 0 && !hasExcludePatterns) {
    return [];
  }

  const matchedFiles: string[] = [];

  // パターンに基づいてファイルを直接検索
  function scanDirectory(dir: string, baseDir: string = workdir) {
    try {
      const entries = readdirSync(dir);

      for (const entry of entries) {
        const fullPath = join(dir, entry);
        const relativePath = relative(baseDir, fullPath);

        // .gitディレクトリはスキップ
        if (entry === '.git') continue;

        // ===== 追加: ディレクトリ自体が除外パターン / 仮想環境に一致する場合は再帰しない =====
        if (
          excludePatterns &&
          excludePatterns.some(
            (p) => matchesPattern(entry, p) || matchesPattern(relativePath, p)
          )
        ) {
          // エントリ自体が除外対象
          continue;
        }

        // 仮想環境ディレクトリの除外はフラグに基づいて決定
        if (skipVirtualEnvs && isVirtualEnv(relativePath)) {
          continue;
        }

        try {
          const stat = statSync(fullPath);

          if (stat.isDirectory()) {
            // ディレクトリの場合は再帰的に検索
            scanDirectory(fullPath, baseDir);
          } else if (stat.isFile()) {
            // ファイルの場合はパターンマッチング

            // 除外パターンのチェック
            if (excludePatterns) {
              let isExcluded = false;
              for (const excludePattern of excludePatterns) {
                if (
                  matchesPattern(entry, excludePattern) ||
                  matchesPattern(relativePath, excludePattern)
                ) {
                  isExcluded = true;
                  break;
                }
              }
              if (isExcluded) continue;
            }

            // patterns が空の場合は全ファイルを対象とする
            // patterns が指定されている場合はマッチするファイルのみ対象
            let shouldInclude = patterns.length === 0;

            if (patterns.length > 0) {
              for (const pattern of patterns) {
                if (
                  matchesPattern(entry, pattern) ||
                  matchesPattern(relativePath, pattern)
                ) {
                  shouldInclude = true;
                  break;
                }
              }
            }

            if (shouldInclude) {
              // gitで追跡されていないファイルのみを対象とする
              try {
                execSync(
                  `git ls-files --error-unmatch ${escapeShellArg(relativePath)}`,
                  {
                    cwd: baseDir,
                    stdio: 'ignore',
                  }
                );
                // ファイルが追跡されている場合はスキップ
              } catch {
                // ファイルが追跡されていない場合は含める
                matchedFiles.push(relativePath);
              }
            }
          }
        } catch {
          // ファイルアクセスエラーは無視
        }
      }
    } catch {
      // ディレクトリスキャンエラーは無視
    }
  }

  scanDirectory(workdir);

  return matchedFiles;
}

/**
 * ファイル名がパターンにマッチするかチェック
 * 簡易的なワイルドカードマッチング
 */
function matchesPattern(file: string, pattern: string): boolean {
  // 簡易的なワイルドカードマッチング
  // * を任意の文字列に変換
  const regexPattern = pattern
    .split('*')
    .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('.*');

  const regex = new RegExp(`^${regexPattern}$`);
  return regex.test(file);
}

export interface CopyFilesResult {
  copied: string[];
  skippedVirtualEnvs: string[];
  skippedOversize: string[];
}

/**
 * ファイルを別のディレクトリにコピー
 * シンボリックリンクを適切に処理し、仮想環境は除外
 * @param sourceDir コピー元ディレクトリ
 * @param targetDir コピー先ディレクトリ
 * @param files コピーするファイルのリスト（相対パス）
 * @returns コピーしたファイルのリスト
 */
export async function copyFiles(
  sourceDir: string,
  targetDir: string,
  files: string[]
): Promise<CopyFilesResult> {
  // Node 組み込み promises API を使用
  const { copyFile, mkdir, lstat, readlink, symlink, realpath } = await import(
    'fs/promises'
  );
  const os = await import('os');

  const copiedFiles: string[] = [];
  const skippedVirtualEnvSet = new Set<string>();
  const skippedOversize: string[] = [];

  const { virtual_env_handling } = loadConfig();
  const isIsolationEnabled = (() => {
    if (!virtual_env_handling) return false; // デフォルト disabled
    if (typeof virtual_env_handling.isolate_virtual_envs === 'boolean') {
      return virtual_env_handling.isolate_virtual_envs;
    }
    // 後方互換: mode
    return virtual_env_handling.mode === 'skip';
  })();

  // サイズ上限 (バイト)
  const maxFileSizeBytes =
    virtual_env_handling?.max_file_size_mb !== undefined
      ? virtual_env_handling.max_file_size_mb >= 0
        ? virtual_env_handling.max_file_size_mb * 1024 * 1024
        : undefined
      : virtual_env_handling?.max_copy_size_mb &&
          virtual_env_handling.max_copy_size_mb > 0
        ? virtual_env_handling.max_copy_size_mb * 1024 * 1024
        : undefined;

  const maxDirSizeBytes =
    virtual_env_handling?.max_dir_size_mb !== undefined
      ? virtual_env_handling.max_dir_size_mb >= 0
        ? virtual_env_handling.max_dir_size_mb * 1024 * 1024
        : undefined
      : undefined;

  // ディレクトリ単位で累積サイズを追跡
  const dirSizeMap = new Map<string, number>();

  // 並列度
  const parallelism =
    virtual_env_handling?.copy_parallelism !== undefined
      ? virtual_env_handling.copy_parallelism === 0
        ? os.cpus().length
        : virtual_env_handling.copy_parallelism
      : 4;

  const active: Promise<void>[] = [];

  async function processFile(file: string): Promise<void> {
    try {
      const sourcePath = join(sourceDir, file);
      const targetPath = join(targetDir, file);

      if (!existsSync(sourcePath)) return;

      if (isIsolationEnabled && isVirtualEnv(file)) {
        // 先頭セグメントだけではなく、相対パス全体を保持して詳細を提供する
        skippedVirtualEnvSet.add(file);
        return;
      }

      const lst = await lstat(sourcePath);

      if (!lst.isSymbolicLink() && maxFileSizeBytes !== undefined) {
        if (lst.size > maxFileSizeBytes) {
          skippedOversize.push(file);
          return;
        }
      }

      if (!lst.isSymbolicLink() && maxDirSizeBytes !== undefined) {
        const dirRel = dirname(file) || '.';
        let violates = false;
        let cursor = dirRel;
        while (true) {
          const current = dirSizeMap.get(cursor) ?? 0;
          if (current + lst.size > maxDirSizeBytes) {
            violates = true;
            break;
          }
          if (cursor === '.') break;
          const parent = dirname(cursor);
          if (parent === cursor) break;
          cursor = parent;
        }

        if (violates) {
          skippedOversize.push(file);
          return;
        }

        // サイズ加算
        cursor = dirRel;
        while (true) {
          const current = dirSizeMap.get(cursor) ?? 0;
          dirSizeMap.set(cursor, current + lst.size);
          if (cursor === '.') break;
          const parent = dirname(cursor);
          if (parent === cursor) break;
          cursor = parent;
        }
      }

      // ディレクトリ作成
      const targetDirName = dirname(targetPath);
      if (!existsSync(targetDirName))
        await mkdir(targetDirName, { recursive: true });

      if (lst.isSymbolicLink()) {
        const linkTarget = await readlink(sourcePath);
        const absoluteLinkTarget = resolve(dirname(sourcePath), linkTarget);

        let rewrittenTarget = absoluteLinkTarget;
        if (isIsolationEnabled) {
          try {
            const realSourceDir = await realpath(sourceDir);
            const targetReal = await realpath(absoluteLinkTarget);
            if (targetReal.startsWith(realSourceDir)) {
              const relFromSource = relative(realSourceDir, targetReal);
              rewrittenTarget = join(targetDir, relFromSource);
            }
          } catch {
            /* ignore */
          }
        }

        let linkSrc = rewrittenTarget;
        if (rewrittenTarget !== absoluteLinkTarget) {
          linkSrc = relative(dirname(targetPath), rewrittenTarget);
        }

        await symlink(linkSrc, targetPath);
        copiedFiles.push(file);
      } else {
        await copyFile(sourcePath, targetPath);
        copiedFiles.push(file);
      }
    } catch {
      /* ignore individual errors */
    }
  }

  for (const file of files) {
    const p = processFile(file).then(() => {
      const idx = active.indexOf(p);
      if (idx >= 0) active.splice(idx, 1);
    });
    active.push(p);
    if (active.length >= parallelism) {
      await Promise.race(active);
    }
  }

  await Promise.all(active);

  return {
    copied: copiedFiles,
    skippedVirtualEnvs: [...skippedVirtualEnvSet],
    skippedOversize,
  };
}
