/**
 * 非同期処理共通ユーティリティ
 */

/**
 * 並列実行制御付きでタスクを実行する
 * @param tasks 実行するタスクの配列
 * @param concurrency 最大並列数
 * @returns すべてのタスクの結果
 */
export async function executeWithConcurrency<T>(
  tasks: (() => Promise<T>)[],
  concurrency: number
): Promise<T[]> {
  const results: T[] = [];
  const active: Promise<void>[] = [];

  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i];
    const promise = task().then((result) => {
      results[i] = result;
      const index = active.indexOf(promise);
      if (index >= 0) {
        active.splice(index, 1);
      }
    });

    active.push(promise);

    if (active.length >= concurrency) {
      await Promise.race(active);
    }
  }

  await Promise.all(active);
  return results;
}

/**
 * タイムアウト付きでPromiseを実行する
 * @param promise 実行するPromise
 * @param timeoutMs タイムアウト時間（ミリ秒）
 * @returns 結果またはタイムアウトエラー
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Timeout')), timeoutMs)
    ),
  ]);
}

/**
 * 失敗時にリトライする
 * @param fn 実行する関数
 * @param maxRetries 最大リトライ回数
 * @param delayMs リトライ間隔（ミリ秒）
 * @returns 結果
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  delayMs: number = 1000
): Promise<T> {
  let lastError: Error = new Error('Unknown error');

  for (let i = 0; i <= maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (i < maxRetries) {
        await sleep(delayMs);
      }
    }
  }

  throw lastError;
}

/**
 * 指定時間待機する
 * @param ms 待機時間（ミリ秒）
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 配列の各要素に対して非同期関数を順次実行する
 * @param items 処理する配列
 * @param fn 各要素に適用する非同期関数
 * @returns 結果の配列
 */
export async function mapSequential<T, U>(
  items: T[],
  fn: (item: T, index: number) => Promise<U>
): Promise<U[]> {
  const results: U[] = [];

  for (let i = 0; i < items.length; i++) {
    results.push(await fn(items[i], i));
  }

  return results;
}

/**
 * 配列の各要素に対して非同期関数を並列実行する（制限あり）
 * @param items 処理する配列
 * @param fn 各要素に適用する非同期関数
 * @param concurrency 最大並列数
 * @returns 結果の配列
 */
export async function mapConcurrent<T, U>(
  items: T[],
  fn: (item: T, index: number) => Promise<U>,
  concurrency: number = 4
): Promise<U[]> {
  const tasks = items.map((item, index) => () => fn(item, index));
  return executeWithConcurrency(tasks, concurrency);
}

/**
 * すべてのPromiseが完了するまで待機し、成功・失敗を区別する
 * @param promises 実行するPromiseの配列
 * @returns 成功・失敗の結果
 */
export async function allSettled<T>(promises: Promise<T>[]): Promise<{
  succeeded: T[];
  failed: Error[];
}> {
  const results = await Promise.allSettled(promises);
  const succeeded: T[] = [];
  const failed: Error[] = [];

  results.forEach((result) => {
    if (result.status === 'fulfilled') {
      succeeded.push(result.value);
    } else {
      failed.push(
        result.reason instanceof Error
          ? result.reason
          : new Error(String(result.reason))
      );
    }
  });

  return { succeeded, failed };
}
