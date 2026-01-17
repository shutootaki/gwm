import { execSync } from 'child_process';
import { existsSync, readdirSync, statSync } from 'fs';
import {
  copyFile,
  mkdir,
  lstat,
  readlink,
  symlink,
  realpath,
} from 'fs/promises';
import { cpus } from 'os';
import { join, dirname, relative, resolve } from 'path';
import { loadConfig } from '../../config.js';
import { escapeShellArg } from '../shell.js';
import { isVirtualEnv } from '../virtualenv.js';
import type { CopyFilesResult } from './types.js';

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

/**
 * ディレクトリをスキャンしてファイルを探索
 */
function scanDirectory(
  dir: string,
  baseDir: string,
  patterns: string[],
  excludePatterns: string[] | undefined,
  skipVirtualEnvs: boolean,
  matchedFiles: string[]
): void {
  try {
    const entries = readdirSync(dir);

    for (const entry of entries) {
      const fullPath = join(dir, entry);
      const relativePath = relative(baseDir, fullPath);

      // .gitディレクトリはスキップ
      if (entry === '.git') continue;

      // 除外パターンのチェック
      if (
        excludePatterns &&
        excludePatterns.some(
          (p) => matchesPattern(entry, p) || matchesPattern(relativePath, p)
        )
      ) {
        continue;
      }

      // 仮想環境ディレクトリの除外
      if (skipVirtualEnvs && isVirtualEnv(relativePath)) {
        continue;
      }

      try {
        const stat = statSync(fullPath);

        if (stat.isDirectory()) {
          // ディレクトリの場合は再帰的に検索
          scanDirectory(
            fullPath,
            baseDir,
            patterns,
            excludePatterns,
            skipVirtualEnvs,
            matchedFiles
          );
        } else if (stat.isFile()) {
          // ファイルの場合はパターンマッチング
          // patterns が空の場合は全ファイルを対象とする
          const shouldInclude =
            patterns.length === 0 ||
            patterns.some(
              (pattern) =>
                matchesPattern(entry, pattern) ||
                matchesPattern(relativePath, pattern)
            );

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

/**
 * gitignoreされたファイルのリストを取得
 * @param workdir 検索対象のディレクトリ
 * @param patterns 検索パターン（ワイルドカード対応）
 * @param excludePatterns 除外パターン
 * @param skipVirtualEnvs 仮想環境ディレクトリをスキップするかどうか
 */
export function getIgnoredFiles(
  workdir: string,
  patterns: string[],
  excludePatterns?: string[],
  skipVirtualEnvs: boolean = true
): string[] {
  // patterns も excludePatterns も両方空の場合は何もコピーしない
  const hasExcludePatterns = excludePatterns && excludePatterns.length > 0;
  if (patterns.length === 0 && !hasExcludePatterns) {
    return [];
  }

  const matchedFiles: string[] = [];
  scanDirectory(
    workdir,
    workdir,
    patterns,
    excludePatterns,
    skipVirtualEnvs,
    matchedFiles
  );
  return matchedFiles;
}

/**
 * ファイルサイズ制限をチェック
 */
function checkFileSizeLimit(
  file: string,
  size: number,
  maxFileSizeBytes: number | undefined
): boolean {
  return maxFileSizeBytes !== undefined && size > maxFileSizeBytes;
}

/**
 * ディレクトリサイズ制限をチェック
 */
function checkDirectorySizeLimit(
  file: string,
  size: number,
  maxDirSizeBytes: number | undefined,
  dirSizeMap: Map<string, number>
): boolean {
  if (maxDirSizeBytes === undefined) return false;

  const dirRel = dirname(file) || '.';
  let cursor = dirRel;
  while (true) {
    const current = dirSizeMap.get(cursor) ?? 0;
    if (current + size > maxDirSizeBytes) {
      return true;
    }
    if (cursor === '.') break;
    const parent = dirname(cursor);
    if (parent === cursor) break;
    cursor = parent;
  }
  return false;
}

/**
 * ディレクトリサイズを更新
 */
function updateDirectorySize(
  file: string,
  size: number,
  dirSizeMap: Map<string, number>
): void {
  const dirRel = dirname(file) || '.';
  let cursor = dirRel;
  while (true) {
    const current = dirSizeMap.get(cursor) ?? 0;
    dirSizeMap.set(cursor, current + size);
    if (cursor === '.') break;
    const parent = dirname(cursor);
    if (parent === cursor) break;
    cursor = parent;
  }
}

/**
 * シンボリックリンクを処理
 */
async function processSymbolicLink(
  sourcePath: string,
  targetPath: string,
  sourceDir: string,
  targetDir: string,
  isIsolationEnabled: boolean
): Promise<void> {
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
}

/**
 * 個別ファイルを処理
 */
async function processFile(
  file: string,
  sourceDir: string,
  targetDir: string,
  isIsolationEnabled: boolean,
  maxFileSizeBytes: number | undefined,
  maxDirSizeBytes: number | undefined,
  dirSizeMap: Map<string, number>,
  skippedVirtualEnvSet: Set<string>,
  skippedOversize: string[]
): Promise<string | null> {
  try {
    const sourcePath = join(sourceDir, file);
    const targetPath = join(targetDir, file);

    if (!existsSync(sourcePath)) {
      return null;
    }

    if (isIsolationEnabled && isVirtualEnv(file)) {
      skippedVirtualEnvSet.add(file);
      return null;
    }

    const lst = await lstat(sourcePath);

    if (
      !lst.isSymbolicLink() &&
      checkFileSizeLimit(file, lst.size, maxFileSizeBytes)
    ) {
      skippedOversize.push(file);
      return null;
    }

    if (
      !lst.isSymbolicLink() &&
      checkDirectorySizeLimit(file, lst.size, maxDirSizeBytes, dirSizeMap)
    ) {
      skippedOversize.push(file);
      return null;
    }

    if (!lst.isSymbolicLink() && maxDirSizeBytes !== undefined) {
      updateDirectorySize(file, lst.size, dirSizeMap);
    }

    // ディレクトリ作成
    const targetDirName = dirname(targetPath);
    if (!existsSync(targetDirName)) {
      await mkdir(targetDirName, { recursive: true });
    }

    if (lst.isSymbolicLink()) {
      await processSymbolicLink(
        sourcePath,
        targetPath,
        sourceDir,
        targetDir,
        isIsolationEnabled
      );
    } else {
      await copyFile(sourcePath, targetPath);
    }

    return file;
  } catch {
    return null;
  }
}

/**
 * ファイルを別のディレクトリにコピー
 * シンボリックリンクを適切に処理し、仮想環境は除外
 */
export async function copyFiles(
  sourceDir: string,
  targetDir: string,
  files: string[]
): Promise<CopyFilesResult> {
  const copiedFiles: string[] = [];
  const skippedVirtualEnvSet = new Set<string>();
  const skippedOversize: string[] = [];

  const { virtual_env_handling } = loadConfig();
  const isIsolationEnabled = (() => {
    if (!virtual_env_handling) return false;
    if (typeof virtual_env_handling.isolate_virtual_envs === 'boolean') {
      return virtual_env_handling.isolate_virtual_envs;
    }
    return virtual_env_handling.mode === 'skip';
  })();

  // サイズ上限の設定
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

  const dirSizeMap = new Map<string, number>();

  // 並列度
  const parallelism =
    virtual_env_handling?.copy_parallelism !== undefined
      ? virtual_env_handling.copy_parallelism === 0
        ? cpus().length
        : virtual_env_handling.copy_parallelism
      : 4;

  // 並列実行制御用のタスク配列
  const tasks: Array<() => Promise<string | null>> = files.map(
    (file) => () =>
      processFile(
        file,
        sourceDir,
        targetDir,
        isIsolationEnabled,
        maxFileSizeBytes,
        maxDirSizeBytes,
        dirSizeMap,
        skippedVirtualEnvSet,
        skippedOversize
      )
  );

  // 並列実行制御
  const results: (string | null)[] = [];
  const executing: Promise<void>[] = [];

  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i];
    const promise = task().then((result) => {
      results[i] = result;
      const index = executing.indexOf(promise);
      if (index >= 0) {
        executing.splice(index, 1);
      }
    });

    executing.push(promise);

    if (executing.length >= parallelism) {
      await Promise.race(executing);
    }
  }

  // 残りのタスクの完了を待機
  await Promise.all(executing);

  // 成功したファイルのみを結果に含める（元の順序を保持）
  for (let i = 0; i < results.length; i++) {
    if (results[i] !== null) {
      copiedFiles.push(results[i]!);
    }
  }

  return {
    copied: copiedFiles,
    skippedVirtualEnvs: [...skippedVirtualEnvSet],
    skippedOversize,
  };
}
