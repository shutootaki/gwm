import { describe, it, expect, vi, beforeEach } from 'vitest';
import React, { useEffect } from 'react';
import { render } from 'ink-testing-library';
import { useWorktree } from '../src/hooks/useWorktree.js';
import { execSync } from 'child_process';
import { getMainWorktreePath, getIgnoredFiles, copyFiles } from '../src/utils/git.js';
import { loadConfig } from '../src/config.js';

// モジュールモック
vi.mock('child_process', () => ({
  execSync: vi.fn(),
  spawnSync: vi.fn(),
}));

vi.mock('../src/config.js', () => ({
  loadConfig: vi.fn(),
}));

vi.mock('../src/utils/git.js', () => ({
  getRepositoryName: vi.fn(() => 'project'),
  getMainWorktreePath: vi.fn(),
  getIgnoredFiles: vi.fn(),
  copyFiles: vi.fn(),
}));

vi.mock('../src/utils/editor.js', () => ({
  openWithEditor: vi.fn(() => true),
}));

const mockExecSync = vi.mocked(execSync);
const mockGetMainWorktreePath = vi.mocked(getMainWorktreePath);
const mockGetIgnoredFiles = vi.mocked(getIgnoredFiles);
const mockCopyFiles = vi.mocked(copyFiles);
const mockLoadConfig = vi.mocked(loadConfig);

// テスト用ダミーコンポーネント
function HookTester(props: any) {
  const { createWorktree } = useWorktree(props.options);
  useEffect(() => {
    createWorktree('feature-test', false);
  }, []);
  return null;
}

describe('useWorktree copy_ignored_files', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // デフォルトのモック設定
    mockExecSync.mockImplementation((command) => {
      if ((command as string).includes('git show-ref')) {
        throw new Error('Branch not found');
      }
      return '';
    });
    // デフォルトのconfig設定
    mockLoadConfig.mockReturnValue({
      worktree_base_path: '/Users/test/git-worktrees',
      main_branches: ['main'],
      clean_branch: 'ask',
      copy_ignored_files: {
        enabled: true,
        patterns: ['.env', '.env.*'],
        exclude_patterns: ['.env.example'],
      },
    });
  });

  // copy_ignored_filesが有効な場合のファイルコピーをテスト
  it('should copy ignored files when copy_ignored_files is enabled', () => {
    const onSuccess = vi.fn();
    mockGetMainWorktreePath.mockReturnValue('/Users/test/project');
    mockGetIgnoredFiles.mockReturnValue(['.env', '.env.local']);
    mockCopyFiles.mockReturnValue(['.env', '.env.local']);

    render(
      React.createElement(HookTester, {
        options: {
          onSuccess,
          onError: vi.fn(),
        },
      })
    );

    expect(mockGetMainWorktreePath).toHaveBeenCalled();
    expect(mockGetIgnoredFiles).toHaveBeenCalledWith(
      '/Users/test/project',
      ['.env', '.env.*'],
      ['.env.example']
    );
    expect(mockCopyFiles).toHaveBeenCalledWith(
      '/Users/test/project',
      '/Users/test/git-worktrees/project/feature-test',
      ['.env', '.env.local']
    );
    expect(onSuccess).toHaveBeenCalledWith({
      path: '/Users/test/git-worktrees/project/feature-test',
      actions: ['Copied 2 ignored file(s): .env, .env.local'],
    });
  });

  // ファイルが見つからない場合のテスト
  it('should not add action when no files to copy', () => {
    const onSuccess = vi.fn();
    mockGetMainWorktreePath.mockReturnValue('/Users/test/project');
    mockGetIgnoredFiles.mockReturnValue([]);
    mockCopyFiles.mockReturnValue([]);

    render(
      React.createElement(HookTester, {
        options: {
          onSuccess,
          onError: vi.fn(),
        },
      })
    );

    expect(onSuccess).toHaveBeenCalledWith({
      path: '/Users/test/git-worktrees/project/feature-test',
      actions: [],
    });
  });

  // メインワークツリーが見つからない場合のテスト
  it('should skip copy when main worktree not found', () => {
    const onSuccess = vi.fn();
    mockGetMainWorktreePath.mockReturnValue(null);

    render(
      React.createElement(HookTester, {
        options: {
          onSuccess,
          onError: vi.fn(),
        },
      })
    );

    expect(mockGetIgnoredFiles).not.toHaveBeenCalled();
    expect(mockCopyFiles).not.toHaveBeenCalled();
    expect(onSuccess).toHaveBeenCalledWith({
      path: '/Users/test/git-worktrees/project/feature-test',
      actions: [],
    });
  });

  // 同じワークツリーの場合のスキップテスト
  it('should skip copy when source and target are the same', () => {
    const onSuccess = vi.fn();
    mockGetMainWorktreePath.mockReturnValue('/Users/test/git-worktrees/project/feature-test');

    render(
      React.createElement(HookTester, {
        options: {
          onSuccess,
          onError: vi.fn(),
        },
      })
    );

    expect(mockGetIgnoredFiles).not.toHaveBeenCalled();
    expect(mockCopyFiles).not.toHaveBeenCalled();
  });

  // copy_ignored_filesが無効な場合のテスト
  it('should not copy files when copy_ignored_files is disabled', () => {
    mockLoadConfig.mockReturnValue({
      worktree_base_path: '/Users/test/git-worktrees',
      main_branches: ['main'],
      clean_branch: 'ask',
      copy_ignored_files: {
        enabled: false,
        patterns: ['.env'],
        exclude_patterns: [],
      },
    });

    const onSuccess = vi.fn();

    render(
      React.createElement(HookTester, {
        options: {
          onSuccess,
          onError: vi.fn(),
        },
      })
    );

    expect(mockGetMainWorktreePath).not.toHaveBeenCalled();
    expect(mockGetIgnoredFiles).not.toHaveBeenCalled();
    expect(mockCopyFiles).not.toHaveBeenCalled();
  });

  // 部分的なコピー成功のテスト
  it('should handle partial copy success', () => {
    const onSuccess = vi.fn();
    mockGetMainWorktreePath.mockReturnValue('/Users/test/project');
    mockGetIgnoredFiles.mockReturnValue(['.env', '.env.local', '.env.test']);
    mockCopyFiles.mockReturnValue(['.env', '.env.local']); // .env.testはコピー失敗

    render(
      React.createElement(HookTester, {
        options: {
          onSuccess,
          onError: vi.fn(),
        },
      })
    );

    expect(mockCopyFiles).toHaveBeenCalledWith(
      '/Users/test/project',
      '/Users/test/git-worktrees/project/feature-test',
      ['.env', '.env.local', '.env.test']
    );
    expect(onSuccess).toHaveBeenCalledWith({
      path: '/Users/test/git-worktrees/project/feature-test',
      actions: ['Copied 2 ignored file(s): .env, .env.local'],
    });
  });

  // 複数のアクションと組み合わせたテスト
  it('should combine copy action with other actions', async () => {
    const { openWithEditor } = await import('../src/utils/editor.js');
    vi.mocked(openWithEditor).mockReturnValue(true);

    const onSuccess = vi.fn();
    mockGetMainWorktreePath.mockReturnValue('/Users/test/project');
    mockGetIgnoredFiles.mockReturnValue(['.env']);
    mockCopyFiles.mockReturnValue(['.env']);

    render(
      React.createElement(HookTester, {
        options: {
          openCode: true,
          onSuccess,
          onError: vi.fn(),
        },
      })
    );

    expect(onSuccess).toHaveBeenCalledWith({
      path: '/Users/test/git-worktrees/project/feature-test',
      actions: ['Copied 1 ignored file(s): .env', 'VS Code opened'],
    });
  });
});