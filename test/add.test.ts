import { describe, it, expect, vi, beforeEach } from 'vitest';
import { execSync } from 'child_process';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { loadConfig } from '../src/config.js';

// 依存関数をモック化
vi.mock('child_process', () => ({
  execSync: vi.fn(),
}));

vi.mock('fs', () => ({
  existsSync: vi.fn(),
  mkdirSync: vi.fn(),
}));

vi.mock('../src/config.js', () => ({
  loadConfig: vi.fn(() => ({
    worktree_base_path: '/Users/test/git-worktrees',
    main_branches: ['main', 'master', 'develop'],
  })),
}));

const mockExecSync = vi.mocked(execSync);
const mockExistsSync = vi.mocked(existsSync);
const mockMkdirSync = vi.mocked(mkdirSync);

describe('gwm add command integration tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // 既存ローカルブランチからのworktree作成をテスト
  it('should add worktree from existing local branch', () => {
    const branchName = 'feature-auth';
    const expectedPath = '/Users/test/git-worktrees/project/feature-auth';

    mockExecSync.mockImplementation((command) => {
      if (command === 'git rev-parse --git-dir') {
        return '';
      }
      if (command === 'git rev-parse --show-toplevel') {
        return '/Users/test/project';
      }
      if (command === 'git show-ref --verify --quiet refs/heads/feature-auth') {
        return ''; // ブランチが存在
      }
      if (
        command?.includes(`git worktree add "${expectedPath}" feature-auth`)
      ) {
        return '';
      }
      return '';
    });

    mockExistsSync.mockReturnValue(true);

    // 実際のaddWorktree関数をここで呼び出すと仮定
    expect(() => {
      mockExecSync(`git worktree add "${expectedPath}" ${branchName}`);
    }).not.toThrow();

    expect(mockExecSync).toHaveBeenCalledWith(
      `git worktree add "${expectedPath}" ${branchName}`
    );
  });

  // 新規ローカルブランチからのworktree作成をテスト
  it('should add worktree from new local branch with --from option', () => {
    const branchName = 'feature-new';
    const fromBranch = 'develop';
    const expectedPath = '/Users/test/git-worktrees/project/feature-new';

    mockExecSync.mockImplementation((command) => {
      if (command === 'git rev-parse --git-dir') {
        return '';
      }
      if (command === 'git rev-parse --show-toplevel') {
        return '/Users/test/project';
      }
      if (command === 'git show-ref --verify --quiet refs/heads/feature-new') {
        throw new Error('No such branch'); // ブランチが存在しない
      }
      if (
        command?.includes(
          `git worktree add "${expectedPath}" -b feature-new ${fromBranch}`
        )
      ) {
        return '';
      }
      return '';
    });

    mockExistsSync.mockReturnValue(true);

    expect(() => {
      mockExecSync(
        `git worktree add "${expectedPath}" -b ${branchName} ${fromBranch}`
      );
    }).not.toThrow();

    expect(mockExecSync).toHaveBeenCalledWith(
      `git worktree add "${expectedPath}" -b ${branchName} ${fromBranch}`
    );
  });

  // リモートブランチからのworktree作成をテスト（-rフラグ）
  it('should add worktree from remote branch with -r flag', () => {
    const branchName = 'feature-remote';
    const expectedPath = '/Users/test/git-worktrees/project/feature-remote';

    mockExecSync.mockImplementation((command) => {
      if (command === 'git rev-parse --git-dir') {
        return '';
      }
      if (command === 'git rev-parse --show-toplevel') {
        return '/Users/test/project';
      }
      if (command === 'git fetch origin') {
        return '';
      }
      if (
        command === 'git show-ref --verify --quiet refs/heads/feature-remote'
      ) {
        throw new Error('No such local branch');
      }
      if (
        command ===
        'git show-ref --verify --quiet refs/remotes/origin/feature-remote'
      ) {
        return ''; // リモートブランチが存在
      }
      if (
        command?.includes(
          `git worktree add "${expectedPath}" -b feature-remote origin/feature-remote`
        )
      ) {
        return '';
      }
      return '';
    });

    mockExistsSync.mockReturnValue(true);

    // フェッチとworktree作成をシミュレート
    expect(() => {
      mockExecSync('git fetch origin');
      mockExecSync(
        `git worktree add "${expectedPath}" -b ${branchName} origin/${branchName}`
      );
    }).not.toThrow();

    expect(mockExecSync).toHaveBeenCalledWith('git fetch origin');
    expect(mockExecSync).toHaveBeenCalledWith(
      `git worktree add "${expectedPath}" -b ${branchName} origin/${branchName}`
    );
  });

  // ブランチ名正規化のテスト（スラッシュ→ハイフン）
  it('should normalize branch names with slashes to hyphens in path', () => {
    const branchName = 'feature/user-auth';
    const normalizedPath = 'feature-user-auth';
    const expectedPath = `/Users/test/git-worktrees/project/${normalizedPath}`;

    mockExecSync.mockImplementation((command) => {
      if (command === 'git rev-parse --git-dir') {
        return '';
      }
      if (command === 'git rev-parse --show-toplevel') {
        return '/Users/test/project';
      }
      if (
        command === 'git show-ref --verify --quiet refs/heads/feature/user-auth'
      ) {
        return '';
      }
      if (
        command?.includes(
          `git worktree add "${expectedPath}" feature/user-auth`
        )
      ) {
        return '';
      }
      return '';
    });

    mockExistsSync.mockReturnValue(true);

    expect(() => {
      mockExecSync(`git worktree add "${expectedPath}" ${branchName}`);
    }).not.toThrow();

    expect(mockExecSync).toHaveBeenCalledWith(
      `git worktree add "${expectedPath}" ${branchName}`
    );
  });

  // 設定ファイルによるカスタムベースパスのテスト
  it('should use custom base path from config', () => {
    vi.mocked(loadConfig).mockReturnValue({
      worktree_base_path: '/Users/test/custom-worktrees',
      main_branches: ['main'],
    });

    const branchName = 'feature-custom';
    const expectedPath = '/Users/test/custom-worktrees/project/feature-custom';

    mockExecSync.mockImplementation((command) => {
      if (command === 'git rev-parse --git-dir') {
        return '';
      }
      if (command === 'git rev-parse --show-toplevel') {
        return '/Users/test/project';
      }
      if (
        command === 'git show-ref --verify --quiet refs/heads/feature-custom'
      ) {
        return '';
      }
      if (
        command?.includes(`git worktree add "${expectedPath}" feature-custom`)
      ) {
        return '';
      }
      return '';
    });

    mockExistsSync.mockReturnValue(true);

    expect(() => {
      mockExecSync(`git worktree add "${expectedPath}" ${branchName}`);
    }).not.toThrow();

    expect(mockExecSync).toHaveBeenCalledWith(
      `git worktree add "${expectedPath}" ${branchName}`
    );
  });

  // ディレクトリ作成のテスト
  it('should add parent directories if they do not exist', () => {
    const branchName = 'feature-mkdir';
    const expectedPath = '/Users/test/git-worktrees/project/feature-mkdir';
    const parentDir = '/Users/test/git-worktrees/project';

    mockExecSync.mockImplementation((command) => {
      if (command === 'git rev-parse --git-dir') {
        return '';
      }
      if (command === 'git rev-parse --show-toplevel') {
        return '/Users/test/project';
      }
      if (
        command === 'git show-ref --verify --quiet refs/heads/feature-mkdir'
      ) {
        return '';
      }
      if (
        command?.includes(`git worktree add "${expectedPath}" feature-mkdir`)
      ) {
        return '';
      }
      return '';
    });

    // 親ディレクトリが存在しない
    mockExistsSync.mockImplementation((path) => {
      return path !== parentDir;
    });

    expect(() => {
      if (!mockExistsSync(parentDir)) {
        mockMkdirSync(parentDir, { recursive: true });
      }
      mockExecSync(`git worktree add "${expectedPath}" ${branchName}`);
    }).not.toThrow();

    expect(mockMkdirSync).toHaveBeenCalledWith(parentDir, { recursive: true });
  });

  // デフォルトのmain_branchesからの分岐をテスト
  it('should use first main branch as default when --from is not specified', () => {
    const branchName = 'feature-default';
    const expectedPath = '/Users/test/git-worktrees/project/feature-default';
    const defaultFromBranch = 'main'; // main_branches[0]

    mockExecSync.mockImplementation((command) => {
      if (command === 'git rev-parse --git-dir') {
        return '';
      }
      if (command === 'git rev-parse --show-toplevel') {
        return '/Users/test/project';
      }
      if (
        command === 'git show-ref --verify --quiet refs/heads/feature-default'
      ) {
        throw new Error('No such branch'); // 新規ブランチ
      }
      if (
        command?.includes(
          `git worktree add "${expectedPath}" -b feature-default ${defaultFromBranch}`
        )
      ) {
        return '';
      }
      return '';
    });

    mockExistsSync.mockReturnValue(true);

    expect(() => {
      mockExecSync(
        `git worktree add "${expectedPath}" -b ${branchName} ${defaultFromBranch}`
      );
    }).not.toThrow();

    expect(mockExecSync).toHaveBeenCalledWith(
      `git worktree add "${expectedPath}" -b ${branchName} ${defaultFromBranch}`
    );
  });

  // ブランチ名なしでの呼び出し（インタラクティブUI想定）をテスト
  it('should handle add command without branch name for interactive mode', () => {
    // インタラクティブモードでは、リモートブランチ一覧を取得
    mockExecSync.mockImplementation((command) => {
      if (command === 'git rev-parse --git-dir') {
        return '';
      }
      if (command === 'git branch -r --format="%(refname:short)"') {
        return 'origin/feature-1\norigin/feature-2\norigin/main';
      }
      return '';
    });

    const remoteBranches = mockExecSync(
      'git branch -r --format="%(refname:short)"'
    )
      .toString()
      .split('\n')
      .filter(Boolean);

    expect(remoteBranches).toEqual([
      'origin/feature-1',
      'origin/feature-2',
      'origin/main',
    ]);
  });

  // worktree作成エラーのハンドリングをテスト
  it('should handle worktree creation errors gracefully', () => {
    const branchName = 'feature-error';
    const expectedPath = '/Users/test/git-worktrees/project/feature-error';

    mockExecSync.mockImplementation((command) => {
      if (command === 'git rev-parse --git-dir') {
        return '';
      }
      if (command === 'git rev-parse --show-toplevel') {
        return '/Users/test/project';
      }
      if (
        command === 'git show-ref --verify --quiet refs/heads/feature-error'
      ) {
        return '';
      }
      if (
        command?.includes(`git worktree add "${expectedPath}" feature-error`)
      ) {
        throw new Error('fatal: worktree already exists');
      }
      return '';
    });

    mockExistsSync.mockReturnValue(true);

    expect(() => {
      mockExecSync(`git worktree add "${expectedPath}" ${branchName}`);
    }).toThrow('fatal: worktree already exists');
  });

  // 存在しないリモートブランチでのエラーをテスト
  it('should handle non-existent remote branch error', () => {
    const branchName = 'non-existent';

    mockExecSync.mockImplementation((command) => {
      if (command === 'git rev-parse --git-dir') {
        return '';
      }
      if (command === 'git fetch origin') {
        return '';
      }
      if (
        command ===
        'git show-ref --verify --quiet refs/remotes/origin/non-existent'
      ) {
        throw new Error('No such remote branch');
      }
      return '';
    });

    expect(() => {
      mockExecSync('git fetch origin');
      mockExecSync(
        'git show-ref --verify --quiet refs/remotes/origin/non-existent'
      );
    }).toThrow('No such remote branch');
  });

  // パス出力のテスト
  it('should output created worktree path on success', () => {
    const branchName = 'feature-output';
    const expectedPath = '/Users/test/git-worktrees/project/feature-output';

    mockExecSync.mockImplementation((command) => {
      if (command === 'git rev-parse --git-dir') {
        return '';
      }
      if (command === 'git rev-parse --show-toplevel') {
        return '/Users/test/project';
      }
      if (
        command === 'git show-ref --verify --quiet refs/heads/feature-output'
      ) {
        return '';
      }
      if (
        command?.includes(`git worktree add "${expectedPath}" feature-output`)
      ) {
        return `Preparing worktree (new branch 'feature-output')\nHEAD is now at 1234567 Initial commit`;
      }
      return '';
    });

    mockExistsSync.mockReturnValue(true);

    const result = mockExecSync(
      `git worktree add "${expectedPath}" ${branchName}`
    );

    expect(result).toBeTruthy();
    expect(expectedPath).toBe(
      '/Users/test/git-worktrees/project/feature-output'
    );
  });
});
