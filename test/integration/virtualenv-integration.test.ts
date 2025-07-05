import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdirSync, rmSync, writeFileSync, existsSync, symlinkSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { copyFiles } from '../../src/utils/git.js';
import { detectVirtualEnvs, isVirtualEnv } from '../../src/utils/virtualenv.js';
import { loadConfig } from '../../src/config.js';

// モジュールモック
vi.mock('../../src/config.js', () => ({
  loadConfig: vi.fn(),
}));

const mockLoadConfig = vi.mocked(loadConfig);

describe('Virtual Environment Integration Tests', () => {
  let testDir: string;
  let sourceDir: string;
  let targetDir: string;

  beforeEach(() => {
    vi.clearAllMocks();

    // デフォルトで virtual_env_handling を有効にする
    mockLoadConfig.mockReturnValue({
      worktree_base_path: '/Users/test/git-worktrees',
      main_branches: ['main'],
      clean_branch: 'ask',
      virtual_env_handling: {
        mode: 'skip',
        max_copy_size_mb: 100,
      },
    });

    // テスト用の一時ディレクトリを作成
    testDir = join(tmpdir(), `gwm-test-${Date.now()}`);
    sourceDir = join(testDir, 'source');
    targetDir = join(testDir, 'target');

    mkdirSync(sourceDir, { recursive: true });
    mkdirSync(targetDir, { recursive: true });
  });

  afterEach(() => {
    // テスト用ディレクトリをクリーンアップ
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  it('should skip Python virtual environment when copying files', async () => {
    // Python仮想環境のような構造を作成
    const venvDir = join(sourceDir, '.venv');
    mkdirSync(venvDir);
    mkdirSync(join(venvDir, 'bin'));
    writeFileSync(join(venvDir, 'pyvenv.cfg'), 'home = /usr/local/bin');

    // 通常のファイルも作成
    writeFileSync(join(sourceDir, '.env'), 'SECRET_KEY=test');
    writeFileSync(join(sourceDir, 'app.py'), 'print("Hello")');

    const files = ['.venv', '.env', 'app.py'];
    const { copied: copiedFiles, skippedVirtualEnvs } = await copyFiles(
      sourceDir,
      targetDir,
      files
    );

    // .venvはスキップされ、.envとapp.pyだけがコピーされる
    expect(copiedFiles.sort()).toEqual(['.env', 'app.py'].sort());
    expect(existsSync(join(targetDir, '.env'))).toBe(true);
    expect(existsSync(join(targetDir, 'app.py'))).toBe(true);
    expect(existsSync(join(targetDir, '.venv'))).toBe(false);

    // スキップ情報の確認
    expect(skippedVirtualEnvs).toContain('.venv');
  });

  it('should handle symlinks in copied files', async () => {
    // シンボリックリンクのテスト
    writeFileSync(join(sourceDir, 'original.txt'), 'Original content');
    symlinkSync('./original.txt', join(sourceDir, 'link.txt'));

    const files = ['original.txt', 'link.txt'];
    const { copied: copiedFiles } = await copyFiles(
      sourceDir,
      targetDir,
      files
    );

    expect(copiedFiles).toEqual(['original.txt', 'link.txt']);
    expect(existsSync(join(targetDir, 'original.txt'))).toBe(true);
    expect(existsSync(join(targetDir, 'link.txt'))).toBe(true);
  });

  it('should detect multiple virtual environments correctly', () => {
    // 複数の仮想環境を作成
    mkdirSync(join(sourceDir, '.venv'));
    mkdirSync(join(sourceDir, 'node_modules'));
    mkdirSync(join(sourceDir, 'vendor'));
    mkdirSync(join(sourceDir, '.bundle'));
    mkdirSync(join(sourceDir, 'target'));

    const detected = detectVirtualEnvs(sourceDir);

    // 各言語の仮想環境が検出されることを確認
    const languages = detected.map((d) => d.language);
    expect(languages).toContain('Python');
    expect(languages).toContain('Node.js');
    expect(languages).toContain('Ruby');
    expect(languages).toContain('Rust');

    // vendorは複数の言語（Go, PHP）で使われる
    const vendorDetections = detected.filter((d) => d.path === 'vendor');
    expect(vendorDetections.length).toBeGreaterThan(1);
  });

  it('should correctly identify virtual environment directories', () => {
    // 仮想環境の判定テスト
    expect(isVirtualEnv('.venv')).toBe(true);
    expect(isVirtualEnv('venv')).toBe(true);
    expect(isVirtualEnv('node_modules')).toBe(true);
    expect(isVirtualEnv('.bundle')).toBe(true);
    expect(isVirtualEnv('vendor')).toBe(true);
    expect(isVirtualEnv('target')).toBe(true);
    expect(isVirtualEnv('_build')).toBe(true);
    expect(isVirtualEnv('deps')).toBe(true);

    // 通常のディレクトリ
    expect(isVirtualEnv('src')).toBe(false);
    expect(isVirtualEnv('lib')).toBe(false);
    expect(isVirtualEnv('tests')).toBe(false);
    expect(isVirtualEnv('docs')).toBe(false);
  });

  it('should not skip virtual environments when virtual_env_handling is not configured', async () => {
    // virtual_env_handling が設定されていない場合
    mockLoadConfig.mockReturnValue({
      worktree_base_path: '/Users/test/git-worktrees',
      main_branches: ['main'],
      clean_branch: 'ask',
    });

    // Python仮想環境のような構造を作成
    const venvDir = join(sourceDir, '.venv');
    mkdirSync(venvDir);
    writeFileSync(join(venvDir, 'file.txt'), 'content');

    // ディレクトリ内のファイルを指定
    const files = ['.venv/file.txt'];
    const { copied: copiedFiles, skippedVirtualEnvs } = await copyFiles(
      sourceDir,
      targetDir,
      files
    );

    // virtual_env_handling が未定義の場合はデフォルトで隔離が無効 -> .venv 内もコピーされる
    expect(copiedFiles).toEqual(['.venv/file.txt']);
    expect(existsSync(join(targetDir, '.venv', 'file.txt'))).toBe(true);

    // スキップリストは空
    expect(skippedVirtualEnvs).toEqual([]);
  });

  it('should handle complex project with mixed files and virtual environments', async () => {
    // 複雑なプロジェクト構造を作成
    mkdirSync(join(sourceDir, '.venv'));
    mkdirSync(join(sourceDir, 'node_modules'));
    mkdirSync(join(sourceDir, 'src'));
    writeFileSync(join(sourceDir, '.env'), 'API_KEY=secret');
    writeFileSync(join(sourceDir, '.env.local'), 'LOCAL_KEY=local');
    writeFileSync(join(sourceDir, 'README.md'), '# Project');
    writeFileSync(join(sourceDir, 'package.json'), '{}');

    // src内にもファイルを作成
    writeFileSync(join(sourceDir, 'src', 'index.js'), 'console.log("Hello")');

    const files = [
      '.venv',
      'node_modules',
      '.env',
      '.env.local',
      'README.md',
      'package.json',
      'src',
    ];

    const { copied: copiedFiles2, skippedVirtualEnvs: skipped2 } =
      await copyFiles(sourceDir, targetDir, files);

    // 仮想環境以外のファイルがコピーされることを確認
    expect(copiedFiles2).toContain('.env');
    expect(copiedFiles2).toContain('.env.local');
    expect(copiedFiles2).toContain('README.md');
    expect(copiedFiles2).toContain('package.json');
    expect(copiedFiles2).not.toContain('.venv');
    expect(copiedFiles2).not.toContain('node_modules');

    // スキップされた仮想環境の確認
    expect(skipped2).toEqual(['.venv', 'node_modules']);
  });
});
