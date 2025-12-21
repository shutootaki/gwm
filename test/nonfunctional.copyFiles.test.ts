import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdirSync, rmSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { isVirtualEnv } from '../src/utils/virtualenv.js';
import type { Config } from '../src/config/types.js';

// loadConfig をモック
vi.mock('../src/config.js', () => ({
  loadConfig: vi.fn(),
}));

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
    vi.restoreAllMocks();
  });

  it('isVirtualEnv should be case-insensitive', () => {
    expect(isVirtualEnv('NODE_MODULES')).toBe(true);
    expect(isVirtualEnv('VENV')).toBe(true);
    expect(isVirtualEnv('Vendor')).toBe(true);
  });

  it('should skip files larger than max_copy_size_mb', async () => {
    // loadConfig をモックして小さなサイズ制限を設定
    const { loadConfig } = await import('../src/config.js');
    const mockConfig: Config = {
      worktree_base_path: '/tmp/worktrees',
      main_branches: ['main'],
      clean_branch: 'ask',
      virtual_env_handling: {
        isolate_virtual_envs: false,
        max_file_size_mb: 0.001, // 約1KB
        max_dir_size_mb: 500,
        max_scan_depth: 5,
        copy_parallelism: 4,
      },
    };
    vi.mocked(loadConfig).mockReturnValue(mockConfig);

    // copyFiles を動的にインポート（モック適用後）
    const { copyFiles } = await import('../src/utils/git/index.js');

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
  });
});
