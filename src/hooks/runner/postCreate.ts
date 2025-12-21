import { spawn } from 'child_process';
import type { Config } from '../../config/types.js';
import type { HookContext, HookResult } from './types.js';
import { createLogger } from '../../utils/logger.js';

// テスト環境では出力抑制するロガー
const log = createLogger();

/**
 * シェルコマンドを実行し、標準出力/エラーをそのまま端末に流す
 */
async function executeCommand(
  command: string,
  cwd: string,
  env: typeof process.env
): Promise<{ success: boolean; exitCode: number }> {
  return new Promise((resolve) => {
    const child = spawn(command, {
      cwd,
      shell: true,
      stdio: 'inherit',
      env,
    });

    child.on('close', (code) => {
      resolve({
        success: code === 0,
        exitCode: code ?? 1,
      });
    });

    child.on('error', (err) => {
      log.error(`Command spawn error: ${err.message}`);
      resolve({
        success: false,
        exitCode: 1,
      });
    });
  });
}

/**
 * post_create hook を実行
 *
 * @param config 有効な設定
 * @param context hook コンテキスト
 * @returns hook 実行結果
 */
export async function runPostCreateHooks(
  config: Config,
  context: HookContext
): Promise<HookResult> {
  const hook = config.hooks?.post_create;

  // hook が未設定または無効の場合はスキップ
  if (!hook || hook.enabled === false) {
    return { success: true, executedCount: 0 };
  }

  const commands = hook.commands ?? [];
  if (commands.length === 0) {
    return { success: true, executedCount: 0 };
  }

  // hook 用環境変数を準備
  const hookEnv: typeof process.env = {
    ...process.env,
    GWM_WORKTREE_PATH: context.worktreePath,
    GWM_BRANCH_NAME: context.branchName,
    GWM_REPO_ROOT: context.repoRoot,
    GWM_REPO_NAME: context.repoName,
  };

  log.info(
    `Running post_create hooks (${commands.length} command${commands.length > 1 ? 's' : ''})...`
  );

  for (let i = 0; i < commands.length; i++) {
    const cmd = commands[i];
    log.info(`  [${i + 1}/${commands.length}] Executing: ${cmd}`);

    const result = await executeCommand(cmd, context.worktreePath, hookEnv);

    if (!result.success) {
      log.error(`  ✗ [${i + 1}/${commands.length}] ${cmd} (failed)`);
      log.error(`    Exit code: ${result.exitCode}`);
      return {
        success: false,
        executedCount: i + 1,
        failedCommand: cmd,
        exitCode: result.exitCode,
      };
    }

    // 各コマンド完了時のログ
    log.success(`  ✓ [${i + 1}/${commands.length}] ${cmd} (completed)`);
  }

  // 完了ログを出力
  log.success(
    `✓ post_create hooks completed (${commands.length}/${commands.length})`
  );

  return {
    success: true,
    executedCount: commands.length,
  };
}
