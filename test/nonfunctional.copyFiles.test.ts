import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { copyFiles } from '../src/utils/git.js';
import { isVirtualEnv } from '../src/utils/virtualenv.js';

/**
 * 非機能要件 (サイズ上限・大文字小文字無視) に関するテスト
 */

describe('Non-functional requirements', () => {
  let testDir: string;
  let sourceDir: string;
  let targetDir: string;

  beforeEach(() => {
    testDir = join(tmpdir(), `gwm-nonfunc-${Date.now()}`);
    sourceDir = join(testDir, 'src');
    targetDir = join(testDir, 'dst');
    mkdirSync(sourceDir, { recursive: true });
    mkdirSync(targetDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  it('isVirtualEnv should be case-insensitive', () => {
    expect(isVirtualEnv('NODE_MODULES')).toBe(true);
    expect(isVirtualEnv('VENV')).toBe(true);
    expect(isVirtualEnv('Vendor')).toBe(true);
  });

  it('should skip files larger than max_copy_size_mb', async () => {
    // デフォルト 100 MB だと大きすぎるので、環境変数 HOME を上書きしテスト専用 config を注入
    const fakeHome = join(testDir, 'home');
    mkdirSync(join(fakeHome, '.config', 'gwm'), { recursive: true });
    const configPath = join(fakeHome, '.config', 'gwm', 'config.toml');
    writeFileSync(
      configPath,
      `\n[virtual_env_handling]\nmax_copy_size_mb = 0.001 # 約1KB\n`
    );

    // HOME を切り替えて config 読み込みを誘発 (他テストへの影響を避けるため退避)
    const originalHome = process.env.HOME;
    process.env.HOME = fakeHome;

    // 2KB のファイルを作成 (制限超過)
    const bigFile = 'big.bin';
    const bigBuf = Buffer.alloc(2048, 0);
    writeFileSync(join(sourceDir, bigFile), bigBuf);

    const files = [bigFile];
    const { copied, skippedOversize } = await copyFiles(
      sourceDir,
      targetDir,
      files
    );

    // コピーされない
    expect(copied).toEqual([]);
    expect(skippedOversize).toEqual([bigFile]);
    expect(existsSync(join(targetDir, bigFile))).toBe(false);

    // HOME を戻す
    if (originalHome) {
      process.env.HOME = originalHome;
    }
  });
});
