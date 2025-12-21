import { describe, it, expect, vi, beforeEach } from 'vitest';
import React, { useEffect } from 'react';
import { render } from 'ink-testing-library';

// --- モジュールモックを先に宣言（hoisting 対策） ---
vi.mock('child_process', () => ({
  execSync: vi.fn(),
  exec: vi.fn(),
}));

vi.mock('../src/config.js', () => ({
  loadConfig: vi.fn(),
}));

vi.mock('../src/utils/git.js', () => ({
  getRepositoryName: vi.fn(() => 'project'),
  getMainWorktreePath: vi.fn(),
  getIgnoredFiles: vi.fn(),
  copyFiles: vi.fn(),
  getRepoRoot: vi.fn(() => '/Users/test/project'),
}));

vi.mock('../src/utils/virtualenv.js', () => ({
  detectVirtualEnvs: vi.fn(),
  suggestSetupCommands: vi.fn(),
  getVirtualEnvExcludePatterns: vi.fn(() => []),
  isVirtualEnv: vi.fn(),
}));

vi.mock('../src/utils/editor.js', () => ({
  openWithEditor: vi.fn(() => true),
}));

vi.mock('../src/hooks/runner/index.js', () => ({
  runPostCreateHooks: vi.fn(() =>
    Promise.resolve({ success: true, executedCount: 0 })
  ),
}));

// ここでモジュールをインポート（モック適用後）
import { useWorktree } from '../src/hooks/useWorktree.js';
import {
  detectVirtualEnvs,
  suggestSetupCommands,
} from '../src/utils/virtualenv.js';
import {
  getMainWorktreePath,
  copyFiles,
  getIgnoredFiles,
  getRepositoryName,
} from '../src/utils/git.js';
import { loadConfig } from '../src/config.js';
import { execSync } from 'child_process';

// モック関数のキャッシュ (imports 後)
const mockLoadConfig = vi.mocked(loadConfig);
const mockGetRepositoryName = vi.mocked(getRepositoryName);
const mockGetMainWorktreePath = vi.mocked(getMainWorktreePath);
const mockDetectVirtualEnvs = vi.mocked(detectVirtualEnvs);
const mockSuggestSetupCommands = vi.mocked(suggestSetupCommands);
const mockCopyFiles = vi.mocked(copyFiles);
const mockGetIgnoredFiles = vi.mocked(getIgnoredFiles);
const mockExecSync = vi.mocked(execSync);

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

describe('useWorktree virtual environment detection', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // デフォルトモックの設定（virtual_env_handling を明示的に有効化）
    mockLoadConfig.mockReturnValue({
      worktree_base_path: '/Users/test/git-worktrees',
      main_branches: ['main'],
      clean_branch: 'ask',
      copy_ignored_files: {
        enabled: true,
        patterns: ['.env'],
        exclude_patterns: [],
      },
      virtual_env_handling: {
        isolate_virtual_envs: true,
        max_file_size_mb: 100,
        max_dir_size_mb: 500,
        max_scan_depth: 5,
        copy_parallelism: 4,
      },
    });
    mockGetRepositoryName.mockReturnValue('project');
    mockGetMainWorktreePath.mockReturnValue('/Users/test/project');
    mockExecSync.mockReturnValue('');
  });

  it('should detect and report Python virtual environments', async () => {
    const detectedEnvs = [
      { language: 'Python', path: '.venv', pattern: '.venv' },
      { language: 'Python', path: '__pycache__', pattern: '__pycache__' },
    ];
    const setupCommands = [
      '# Python: Choose one of the following:',
      '  python -m venv .venv',
      '  poetry install',
      '  pipenv install',
      '  conda env create',
    ];

    mockDetectVirtualEnvs.mockReturnValue(detectedEnvs);
    mockSuggestSetupCommands.mockReturnValue(setupCommands);
    mockGetIgnoredFiles.mockReturnValue(['.env']);
    mockCopyFiles.mockResolvedValue({
      copied: ['.env'],
      skippedVirtualEnvs: [],
      skippedOversize: [],
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

    // 非同期処理が完了するまで waitFor で待機
    await vi.waitFor(() => expect(onSuccess).toHaveBeenCalled());

    expect(mockDetectVirtualEnvs).toHaveBeenCalledWith('/Users/test/project');
    expect(mockSuggestSetupCommands).toHaveBeenCalledWith(detectedEnvs);

    const call = onSuccess.mock.calls[0][0];
    expect(call.actions).toContain('Copied 1 ignored file(s): .env');
    expect(call.actions).toContain('');
    expect(call.actions).toContain(
      '📦 Virtual environments detected in the source worktree:'
    );
    expect(call.actions).toContain('  - Python: .venv');
    expect(call.actions).toContain('  - Python: __pycache__');
    expect(call.actions).toContain(
      '💡 To set up your development environment, run:'
    );
    setupCommands.forEach((cmd) => {
      expect(call.actions).toContain(cmd);
    });
  });

  it('should detect multiple language environments', async () => {
    const detectedEnvs = [
      { language: 'Python', path: '.venv', pattern: '.venv' },
      { language: 'Node.js', path: 'node_modules', pattern: 'node_modules' },
      { language: 'Ruby', path: '.bundle', pattern: '.bundle' },
    ];
    const setupCommands = [
      '# Python: Choose one of the following:',
      '  python -m venv .venv',
      '  poetry install',
      '  pipenv install',
      '  conda env create',
      '# Node.js: Choose one of the following:',
      '  npm install',
      '  pnpm install',
      '  yarn install',
      '# Ruby: Choose one of the following:',
      '  bundle install',
    ];

    mockDetectVirtualEnvs.mockReturnValue(detectedEnvs);
    mockSuggestSetupCommands.mockReturnValue(setupCommands);
    mockGetIgnoredFiles.mockReturnValue([]);
    mockCopyFiles.mockResolvedValue({
      copied: [],
      skippedVirtualEnvs: [],
      skippedOversize: [],
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

    // onSuccess が呼ばれるまで待機
    await vi.waitFor(() => expect(onSuccess).toHaveBeenCalled());

    const call = onSuccess.mock.calls[0][0];
    expect(call.actions).toContain(
      '📦 Virtual environments detected in the source worktree:'
    );
    expect(call.actions).toContain('  - Python: .venv');
    expect(call.actions).toContain('  - Node.js: node_modules');
    expect(call.actions).toContain('  - Ruby: .bundle');
  });

  it('should not add virtual environment messages when none detected', async () => {
    mockDetectVirtualEnvs.mockReturnValue([]);
    mockGetIgnoredFiles.mockReturnValue([]);
    mockCopyFiles.mockResolvedValue({
      copied: [],
      skippedVirtualEnvs: [],
      skippedOversize: [],
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

    // onSuccess が呼ばれるまで待機
    await vi.waitFor(() => expect(onSuccess).toHaveBeenCalled());

    const call = onSuccess.mock.calls[0][0];
    expect(call.actions).not.toContain(
      '📦 Virtual environments detected in the source worktree:'
    );
    expect(call.actions).not.toContain(
      '💡 To set up your development environment, run:'
    );
  });

  it('should handle skipped virtual environments during copy', async () => {
    mockDetectVirtualEnvs.mockReturnValue([]);
    mockGetIgnoredFiles.mockReturnValue(['.env', '.venv', 'node_modules']);

    // copyFilesの実装をモック
    mockCopyFiles.mockResolvedValue({
      copied: ['.env'],
      skippedVirtualEnvs: ['.venv', 'node_modules'],
      skippedOversize: [],
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

    // 非同期処理が完了するまで waitFor で待機
    await vi.waitFor(() => expect(onSuccess).toHaveBeenCalled());

    const call = onSuccess.mock.calls[0][0];
    expect(call.actions).toContain('Copied 1 ignored file(s): .env');
    expect(call.actions).toContain(
      'Skipped virtual environment(s): .venv, node_modules'
    );
  });

  it('should handle when main worktree path is not found', () => {
    mockGetMainWorktreePath.mockReturnValue(null);

    const onSuccess = vi.fn();

    render(
      React.createElement(HookTester, {
        options: {
          onSuccess,
          onError: vi.fn(),
        },
      })
    );

    expect(mockDetectVirtualEnvs).not.toHaveBeenCalled();
    expect(mockGetIgnoredFiles).not.toHaveBeenCalled();
    expect(mockCopyFiles).not.toHaveBeenCalled();
  });

  it('should work correctly when copy_ignored_files is disabled but virtual envs exist', async () => {
    mockLoadConfig.mockReturnValue({
      worktree_base_path: '/Users/test/git-worktrees',
      main_branches: ['main'],
      clean_branch: 'ask',
      // copy_ignored_files is not enabled
      virtual_env_handling: {
        isolate_virtual_envs: true,
        max_file_size_mb: 100,
        max_dir_size_mb: 500,
        max_scan_depth: 5,
        copy_parallelism: 4,
      },
    });

    const detectedEnvs = [
      { language: 'Python', path: '.venv', pattern: '.venv' },
    ];
    const setupCommands = [
      '# Python: Choose one of the following:',
      '  python -m venv .venv',
    ];

    mockDetectVirtualEnvs.mockReturnValue(detectedEnvs);
    mockSuggestSetupCommands.mockReturnValue(setupCommands);

    const onSuccess = vi.fn();

    render(
      React.createElement(HookTester, {
        options: {
          onSuccess,
          onError: vi.fn(),
        },
      })
    );

    // copy_ignored_filesが無効でも仮想環境検出は実行されるまで待機
    await vi.waitFor(() =>
      expect(mockDetectVirtualEnvs).toHaveBeenCalledWith('/Users/test/project')
    );

    const call = onSuccess.mock.calls[0][0];
    expect(call.actions).toContain(
      '📦 Virtual environments detected in the source worktree:'
    );
    expect(call.actions).toContain('  - Python: .venv');
  });

  it('should not detect virtual environments when virtual_env_handling is not configured', async () => {
    // virtual_env_handling が設定されていない場合
    mockLoadConfig.mockReturnValue({
      worktree_base_path: '/Users/test/git-worktrees',
      main_branches: ['main'],
      clean_branch: 'ask',
      copy_ignored_files: {
        enabled: true,
        patterns: ['.env'],
        exclude_patterns: [],
      },
      // virtual_env_handling は含まない
    });

    mockGetIgnoredFiles.mockReturnValue(['.env']);
    mockCopyFiles.mockResolvedValue({
      copied: ['.env'],
      skippedVirtualEnvs: [],
      skippedOversize: [],
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

    // 非同期処理が完了するまで waitFor で待機
    await vi.waitFor(() => expect(onSuccess).toHaveBeenCalled());

    // デフォルトでは隔離が無効なため、仮想環境検出は実行されない
    expect(mockDetectVirtualEnvs).not.toHaveBeenCalled();
    expect(mockSuggestSetupCommands).not.toHaveBeenCalled();

    const call = onSuccess.mock.calls[0][0];
    expect(call.actions).not.toContain(
      '📦 Virtual environments detected in the source worktree:'
    );
  });

  it('should not detect virtual environments when isolate_virtual_envs is false', async () => {
    // isolate_virtual_envs が false の場合
    mockLoadConfig.mockReturnValue({
      worktree_base_path: '/Users/test/git-worktrees',
      main_branches: ['main'],
      clean_branch: 'ask',
      copy_ignored_files: {
        enabled: true,
        patterns: ['.env'],
        exclude_patterns: [],
      },
      virtual_env_handling: {
        isolate_virtual_envs: false,
        max_file_size_mb: 100,
        max_dir_size_mb: 500,
        max_scan_depth: 5,
        copy_parallelism: 4,
      },
    });

    mockGetIgnoredFiles.mockReturnValue(['.env']);
    mockCopyFiles.mockResolvedValue({
      copied: ['.env'],
      skippedVirtualEnvs: [],
      skippedOversize: [],
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

    // 非同期処理が完了するまで waitFor で待機
    await vi.waitFor(() => expect(onSuccess).toHaveBeenCalled());

    // isolate_virtual_envs=falseなので仮想環境検出が実行されない
    expect(mockDetectVirtualEnvs).not.toHaveBeenCalled();
    expect(mockSuggestSetupCommands).not.toHaveBeenCalled();

    const call = onSuccess.mock.calls[0][0];
    expect(call.actions).not.toContain(
      '📦 Virtual environments detected in the source worktree:'
    );
  });
});
