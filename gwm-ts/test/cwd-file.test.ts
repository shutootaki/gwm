import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, readFileSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { tryWriteCwdFile } from '../src/utils/cwdFile.js';

describe('cwd file integration', () => {
  const envKey = 'GWM_CWD_FILE';
  const originalEnv = process.env[envKey];

  let tempDir: string;
  let cwdFilePath: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'gwm-test-'));
    cwdFilePath = join(tempDir, 'cwd.txt');
    process.env[envKey] = cwdFilePath;
  });

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env[envKey];
    } else {
      process.env[envKey] = originalEnv;
    }
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('should write target directory to cwd file when env var is set', () => {
    const wrote = tryWriteCwdFile('/tmp/some-dir');
    expect(wrote).toBe(true);

    const content = readFileSync(cwdFilePath, 'utf8');
    expect(content).toBe('/tmp/some-dir');
  });

  it('should return false when env var is not set', () => {
    delete process.env[envKey];
    const wrote = tryWriteCwdFile('/tmp/some-dir');
    expect(wrote).toBe(false);
  });
});
