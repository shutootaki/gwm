/**
 * gwm completion uninstall コマンド
 * 補完スクリプトをアンインストール
 */

import { unlinkSync, existsSync, readFileSync, writeFileSync } from 'fs';
import type { ShellType, CommandResult } from '../types.js';
import {
  getDefaultInstallPath,
  getKiroInstallPath,
  getRcFilePath,
  RC_MARKER_START,
  RC_MARKER_END,
} from './paths.js';

export interface UninstallArgs {
  shell?: ShellType;
  kiro?: boolean;
  all?: boolean;
}

/**
 * 引数をパース
 */
export function parseUninstallArgs(args: string[]): UninstallArgs {
  const result: UninstallArgs = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--shell' && i + 1 < args.length) {
      const nextArg = args[++i];
      if (nextArg === 'bash' || nextArg === 'zsh' || nextArg === 'fish') {
        result.shell = nextArg;
      }
    } else if (arg === '--kiro') {
      result.kiro = true;
    } else if (arg === '--all') {
      result.all = true;
    }
  }

  return result;
}

/**
 * RC ファイルからマーカー区間を削除
 */
function removeRcMarker(rcPath: string): boolean {
  if (!existsSync(rcPath)) {
    return false;
  }

  const content = readFileSync(rcPath, 'utf8');
  if (!content.includes(RC_MARKER_START)) {
    return false;
  }

  // マーカー区間を削除
  const regex = new RegExp(
    `\\n?${RC_MARKER_START}[\\s\\S]*?${RC_MARKER_END}\\n?`,
    'g'
  );
  const newContent = content.replace(regex, '\n');
  writeFileSync(rcPath, newContent, 'utf8');
  return true;
}

/** UninstallResult は CommandResult の別名（後方互換性のため） */
export type UninstallResult = CommandResult;

/** 単一シェルのアンインストールを実行 */
function uninstallShell(shell: ShellType): CommandResult {
  const installPath = getDefaultInstallPath(shell);
  let fileRemoved = false;
  let rcModified = false;

  // ファイル削除
  if (existsSync(installPath)) {
    try {
      unlinkSync(installPath);
      fileRemoved = true;
    } catch (err) {
      return {
        success: false,
        message: `Failed to remove ${shell}: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }

  // RC ファイルからマーカー削除
  const rcPath = getRcFilePath(shell);
  if (rcPath) {
    rcModified = removeRcMarker(rcPath);
  }

  if (!fileRemoved && !rcModified) {
    return {
      success: true,
      message: `${shell}: not installed`,
    };
  }

  const parts: string[] = [];
  if (fileRemoved) {
    parts.push(`${shell}: removed from ${installPath}`);
  }
  if (rcModified) {
    parts.push(`${shell}: removed gwm section from ${rcPath}`);
  }

  return {
    success: true,
    message: parts.join('\n'),
    path: installPath,
    rcModified,
  };
}

/** Kiro/Fig のアンインストールを実行 */
function uninstallKiro(): CommandResult {
  const installPath = getKiroInstallPath();

  if (!existsSync(installPath)) {
    return {
      success: true,
      message: 'kiro: not installed',
    };
  }

  try {
    unlinkSync(installPath);
    return {
      success: true,
      message: `kiro: removed from ${installPath}`,
      path: installPath,
    };
  } catch (err) {
    return {
      success: false,
      message: `Failed to remove kiro: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

/**
 * uninstall コマンドを実行
 */
export function runUninstall(args: UninstallArgs): CommandResult {
  // 一括アンインストール
  if (args.all) {
    const shells: ShellType[] = ['bash', 'zsh', 'fish'];
    const results: CommandResult[] = [];
    let hasError = false;

    // 全シェルをアンインストール
    for (const shell of shells) {
      const result = uninstallShell(shell);
      results.push(result);
      if (!result.success) {
        hasError = true;
      }
    }

    // Kiro/Fig もアンインストール
    const kiroResult = uninstallKiro();
    results.push(kiroResult);
    if (!kiroResult.success) {
      hasError = true;
    }

    // 結果を統合
    const messages = results.map((r) => r.message);
    return {
      success: !hasError,
      message: messages.join('\n'),
    };
  }

  // Kiro/Fig アンインストール
  if (args.kiro) {
    const result = uninstallKiro();
    // 単体実行時は旧形式のメッセージに変換
    if (result.message === 'kiro: not installed') {
      return { ...result, message: 'Kiro/Fig spec is not installed' };
    }
    if (result.message.startsWith('kiro: removed from')) {
      return {
        ...result,
        message: `Removed Kiro/Fig spec from: ${result.path}`,
      };
    }
    return result;
  }

  // シェル補完アンインストール
  if (!args.shell) {
    return {
      success: false,
      message: 'Error: --shell, --kiro, or --all option is required',
    };
  }

  const result = uninstallShell(args.shell);
  // 単体実行時は旧形式のメッセージに変換
  if (result.message === `${args.shell}: not installed`) {
    return { ...result, message: `${args.shell} completion is not installed` };
  }

  // 旧形式のメッセージに変換
  const parts: string[] = [];
  const installPath = getDefaultInstallPath(args.shell);
  const rcPath = getRcFilePath(args.shell);

  if (result.path) {
    parts.push(`Removed ${args.shell} completion from: ${installPath}`);
  }
  if (result.rcModified && rcPath) {
    parts.push(`Removed gwm completion section from: ${rcPath}`);
  }

  if (parts.length > 0) {
    return { ...result, message: parts.join('\n') };
  }

  return result;
}
