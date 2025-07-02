 
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React, { useEffect } from 'react';
import { render } from 'ink-testing-library';
import { useWorktree } from '../src/hooks/useWorktree.js';
import { spawnSync as _spawnSync } from 'child_process';
import { openWithEditor } from '../src/utils/editor.js';

// モジュールモック
vi.mock('child_process', () => ({
  execSync: vi.fn(),
  spawnSync: vi.fn(),
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
}));

vi.mock('../src/utils/editor.js', () => ({
  openWithEditor: vi.fn(() => true),
}));

// プロセス関連をスパイ
const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
  throw new Error('process.exit called');
});

const mockSpawnSync = vi.mocked(_spawnSync);

// テスト用ダミーコンポーネント
function HookTester(props: any) {
  const { createWorktree } = useWorktree(props.options);
  useEffect(() => {
    createWorktree('feature-test', false);
  }, []);
  return null;
}

describe('useWorktree option flags', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should push "VS Code opened" action when openCode=true', () => {
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

    expect(openWithEditor).toHaveBeenCalledWith(
      '/Users/test/git-worktrees/project/feature-test',
      'code'
    );
    expect(onSuccess).toHaveBeenCalledWith({
      path: '/Users/test/git-worktrees/project/feature-test',
      actions: ['VS Code opened'],
    });
  });

  it('should push "Cursor opened" action when openCursor=true', () => {
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

    expect(openWithEditor).toHaveBeenCalledWith(
      '/Users/test/git-worktrees/project/feature-test',
      'cursor'
    );
    expect(onSuccess).toHaveBeenCalledWith({
      path: '/Users/test/git-worktrees/project/feature-test',
      actions: ['Cursor opened'],
    });
  });

  it('should spawn subshell and exit when outputPath=true', () => {
    const onSuccess = vi.fn();

    render(
      React.createElement(HookTester, {
        options: {
          openCode: false,
          openCursor: false,
          outputPath: true,
          onSuccess,
          onError: vi.fn(),
        },
      })
    );

    expect(mockSpawnSync).toHaveBeenCalled();
    expect(mockExit).toHaveBeenCalledWith(0);
  });
});
