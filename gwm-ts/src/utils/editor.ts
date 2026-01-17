import { execSync } from 'child_process';
import { escapeShellArg } from './shell.js';

/** 指定パスを VS Code または Cursor で開く。
 *  インストールされていない場合は false を返す。
 */
export function openWithEditor(
  path: string,
  editor: 'code' | 'cursor'
): boolean {
  try {
    execSync(`${editor} ${escapeShellArg(path)}`, {
      cwd: process.cwd(),
      stdio: 'ignore',
    });
    return true;
  } catch {
    return false;
  }
}
