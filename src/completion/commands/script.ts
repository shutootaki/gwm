/**
 * gwm completion script コマンド
 * 補完スクリプトを標準出力に出力
 */

import type { ShellType } from '../types.js';
import { generateShellScript } from '../generators/shell/index.js';

export interface ScriptArgs {
  shell?: ShellType;
}

/**
 * 引数をパース
 */
export function parseScriptArgs(args: string[]): ScriptArgs {
  let shell: ShellType | undefined;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--shell' && i + 1 < args.length) {
      const nextArg = args[++i];
      if (nextArg === 'bash' || nextArg === 'zsh' || nextArg === 'fish') {
        shell = nextArg;
      }
    }
  }

  return { shell };
}

/**
 * script コマンドを実行
 */
export function runScript(args: ScriptArgs): boolean {
  if (!args.shell) {
    console.error('Error: --shell option is required (bash, zsh, or fish)');
    return false;
  }

  const script = generateShellScript(args.shell);
  process.stdout.write(script);
  return true;
}
