import { writeFileSync } from 'fs';

const CWD_FILE_ENV = 'GWM_CWD_FILE';

export function getCwdFilePath(): string | undefined {
  const value = process.env[CWD_FILE_ENV];
  return value && value.trim() ? value : undefined;
}

/**
 * Write target directory path to `GWM_CWD_FILE` if set.
 *
 * Returns true when written, false when env var is not set.
 */
export function tryWriteCwdFile(targetDir: string): boolean {
  const filePath = getCwdFilePath();
  if (!filePath) return false;

  writeFileSync(filePath, targetDir, { encoding: 'utf8' });
  return true;
}
