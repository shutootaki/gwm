import { describe, it, expect, vi, beforeEach } from 'vitest';
import React, { useEffect } from 'react';
import { render } from 'ink-testing-library';
import { useWorktree } from '../src/hooks/useWorktree.js';
import { spawnSync as _spawnSync } from 'child_process';
import { openWithEditor } from '../src/utils/editor.js';

// モジュールモック
vi.mock('child_process', () => ({
  execSync: vi.fn(() => ''), // git worktree add のために空文字列を返す
  spawnSync: vi.fn(),
  exec: vi.fn(),
}));

vi.mock('../src/config.js', () => ({
  loadConfig: vi.fn(() => ({
    worktree_base_path: '/Users/test/git-worktrees',
    main_branches: ['main'],
    clean_branch: 'ask',
  })),
}));

vi.mock('../src/utils/git.js', () => ({
  getRepositoryName: vi.fn(() => 'project'),
  getMainWorktreePath: vi.fn(() => '/Users/test/project'),
  getIgnoredFiles: vi.fn(() => []),
  copyFiles: vi.fn(() => []),
  getRepoRoot: vi.fn(() => '/Users/test/project'),
}));

vi.mock('../src/utils/editor.js', () => ({
  openWithEditor: vi.fn(() => true),
}));

vi.mock('../src/utils/virtualenv.js', () => ({
  detectVirtualEnvs: vi.fn(() => []),
  suggestSetupCommands: vi.fn(() => []),
}));

vi.mock('../src/hooks/runner/index.js', () => ({
  runPostCreateHooks: vi.fn(() =>
    Promise.resolve({ success: true, executedCount: 0 })
  ),
}));

// プロセス関連をスパイ
const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
  throw new Error('process.exit called');
});

const mockSpawnSync = vi.mocked(_spawnSync);

// spawnSyncのモックを設定
mockSpawnSync.mockReturnValue({
  pid: 123,
  output: [],
  stdout: Buffer.from(''),
  stderr: Buffer.from(''),
  status: 0,
  signal: null,
});

// テスト用ダミーコンポーネント
function HookTester(props: any) {
  const { createWorktree } = useWorktree(props.options);
  useEffect(() => {
    void (async () => {
      await createWorktree('feature-test', false);
    })();
  }, [createWorktree]);
  return null;
}

describe('useWorktree option flags', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should push "VS Code opened" action when openCode=true', async () => {
    const onSuccess = vi.fn();

    render(
      React.createElement(HookTester, {
        options: {
          openCode: true,
          openCursor: false,
          outputPath: false,
          onSuccess,
          onError: vi.fn(),
        },
      })
    );

    // 非同期処理が完了するまで waitFor で待機
    await vi.waitFor(() => expect(onSuccess).toHaveBeenCalled());

    expect(openWithEditor).toHaveBeenCalledWith(
      '/Users/test/git-worktrees/project/feature-test',
      'code'
    );
    const call = onSuccess.mock.calls[0][0];
    expect(call.path).toBe('/Users/test/git-worktrees/project/feature-test');
    expect(call.actions).toContain('VS Code opened');
  });

  it('should push "Cursor opened" action when openCursor=true', async () => {
    const onSuccess = vi.fn();

    render(
      React.createElement(HookTester, {
        options: {
          openCode: false,
          openCursor: true,
          outputPath: false,
          onSuccess,
          onError: vi.fn(),
        },
      })
    );

    // 非同期処理が完了するまで waitFor で待機
    await vi.waitFor(() => expect(onSuccess).toHaveBeenCalled());

    expect(openWithEditor).toHaveBeenCalledWith(
      '/Users/test/git-worktrees/project/feature-test',
      'cursor'
    );
    const call = onSuccess.mock.calls[0][0];
    expect(call.path).toBe('/Users/test/git-worktrees/project/feature-test');
    expect(call.actions).toContain('Cursor opened');
  });

  it('should spawn subshell and exit when outputPath=true', async () => {
    const onSuccess = vi.fn();
    const onError = vi.fn();

    // process.exit をモックで捕捉
    mockExit.mockImplementationOnce(() => {
      // 実際には終了しない
      return undefined as never;
    });

    render(
      React.createElement(HookTester, {
        options: {
          openCode: false,
          openCursor: false,
          outputPath: true,
          onSuccess,
          onError,
        },
      })
    );

    // 非同期処理が完了するまで waitFor で待機
    await vi.waitFor(() => expect(mockSpawnSync).toHaveBeenCalled());

    expect(mockSpawnSync).toHaveBeenCalledWith(
      expect.any(String), // シェルのパス
      expect.objectContaining({
        cwd: '/Users/test/git-worktrees/project/feature-test',
        stdio: 'inherit',
        env: process.env,
      })
    );
    expect(mockExit).toHaveBeenCalledWith(0);
    // spawnSyncが呼ばれたことを確認（これがoutputPath=trueの主要な動作）
    expect(mockSpawnSync).toHaveBeenCalledTimes(1);
  });
});
