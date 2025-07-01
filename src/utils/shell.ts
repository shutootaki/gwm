import { execSync } from 'child_process';

export function escapeShellArg(arg: string): string {
  // シングルクォートで囲み、内部のシングルクォートをエスケープ
  // これにより、$、バッククォート、改行などの特殊文字が安全に処理される
  return "'" + arg.replace(/'/g, "'\\''") + "'";
}

// child_process.execSync を使った簡易ラッパー（主にテスト時にモックしやすくする目的）
export function exec(
  command: string,
  options: Parameters<typeof execSync>[1] = {}
): ReturnType<typeof execSync> {
  return execSync(command, {
    cwd: process.cwd(),
    stdio: 'inherit',
    ...options,
  });
}
