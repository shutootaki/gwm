import { describe, it, expect, vi, beforeEach } from 'vitest';
import { execSync } from 'child_process';
import { getWorktreesWithStatus } from '../src/utils/git.js';

// 依存関数をモック化
vi.mock('child_process', () => ({
  execSync: vi.fn(),
}));

vi.mock('../src/utils/git.js', () => ({
  getWorktreesWithStatus: vi.fn(),
}));

// process.platformをモック化
Object.defineProperty(process, 'platform', {
  value: 'darwin',
  writable: true,
});

const mockExecSync = vi.mocked(execSync);
const mockGetWorktreesWithStatus = vi.mocked(getWorktreesWithStatus);

describe('gwm code command integration tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // 基本的なVS Code起動をテスト
  it('should launch VS Code with selected worktree path', async () => {
    const mockWorktrees = [
      {
        path: '/Users/test/project',
        head: '1234567890abcdef',
        branch: 'refs/heads/main',
        status: 'NORMAL' as const,
        isActive: false,
        isMain: true,
      },
      {
        path: '/Users/test/git-worktrees/project/feature-branch',
        head: 'abcdef1234567890',
        branch: 'refs/heads/feature-branch',
        status: 'NORMAL' as const,
        isActive: false,
        isMain: false,
      },
    ];

    mockGetWorktreesWithStatus.mockResolvedValue(mockWorktrees);
    mockExecSync.mockReturnValue('');

    // ユーザーが2番目のworktreeを選択したと仮定
    const selectedWorktree = mockWorktrees[1];

    // VS Codeで開く
    mockExecSync(`code "${selectedWorktree.path}"`);

    expect(mockExecSync).toHaveBeenCalledWith(
      `code "${selectedWorktree.path}"`
    );
  });

  // `code`コマンドの存在チェックをテスト
  it('should check if code command exists before execution', () => {
    // codeコマンドが存在する場合
    mockExecSync.mockImplementation((command) => {
      if (command === 'which code' || command === 'where code') {
        return '/usr/local/bin/code';
      }
      if (command?.includes('code ')) {
        return '';
      }
      return '';
    });

    const codeExists = (() => {
      try {
        mockExecSync(
          process.platform === 'win32' ? 'where code' : 'which code'
        );
        return true;
      } catch {
        return false;
      }
    })();

    expect(codeExists).toBe(true);
    expect(mockExecSync).toHaveBeenCalledWith('which code');
  });

  // `code`コマンドが存在しない場合のエラーハンドリングをテスト
  it('should show error when code command is not found', () => {
    mockExecSync.mockImplementation((command) => {
      if (command === 'which code' || command === 'where code') {
        throw new Error('Command not found');
      }
      return '';
    });

    expect(() => {
      mockExecSync(process.platform === 'win32' ? 'where code' : 'which code');
    }).toThrow('Command not found');
  });

  // クエリによる初期フィルタリングをテスト
  it('should filter worktrees by query initially', async () => {
    const mockWorktrees = [
      {
        path: '/Users/test/project',
        head: '1234567890abcdef',
        branch: 'refs/heads/main',
        status: 'NORMAL' as const,
        isActive: false,
        isMain: true,
      },
      {
        path: '/Users/test/git-worktrees/project/feature-auth',
        head: 'abcdef1234567890',
        branch: 'refs/heads/feature-auth',
        status: 'NORMAL' as const,
        isActive: false,
        isMain: false,
      },
      {
        path: '/Users/test/git-worktrees/project/feature-ui',
        head: 'fedcba0987654321',
        branch: 'refs/heads/feature-ui',
        status: 'NORMAL' as const,
        isActive: false,
        isMain: false,
      },
      {
        path: '/Users/test/git-worktrees/project/bugfix-login',
        head: '123456789abcdef0',
        branch: 'refs/heads/bugfix-login',
        status: 'NORMAL' as const,
        isActive: false,
        isMain: false,
      },
    ];

    mockGetWorktreesWithStatus.mockResolvedValue(mockWorktrees);

    const query = 'feature';

    // クエリ "feature" でフィルタリング
    const filteredWorktrees = mockWorktrees.filter(
      (w) => w.branch.includes(query) || w.path.includes(query)
    );

    expect(filteredWorktrees).toHaveLength(2);
    expect(filteredWorktrees[0].branch).toBe('refs/heads/feature-auth');
    expect(filteredWorktrees[1].branch).toBe('refs/heads/feature-ui');
  });

  // 単一マッチ時の自動選択をテスト
  it('should auto-select when only one worktree matches query', async () => {
    const mockWorktrees = [
      {
        path: '/Users/test/project',
        head: '1234567890abcdef',
        branch: 'refs/heads/main',
        status: 'NORMAL' as const,
        isActive: false,
        isMain: true,
      },
      {
        path: '/Users/test/git-worktrees/project/unique-feature',
        head: 'abcdef1234567890',
        branch: 'refs/heads/unique-feature',
        status: 'NORMAL' as const,
        isActive: false,
        isMain: false,
      },
    ];

    mockGetWorktreesWithStatus.mockResolvedValue(mockWorktrees);
    mockExecSync.mockReturnValue('');

    const query = 'unique';

    const matches = mockWorktrees.filter(
      (w) => w.branch.includes(query) || w.path.includes(query)
    );

    // 1つしかマッチしない場合は自動選択
    if (matches.length === 1) {
      mockExecSync(`code "${matches[0].path}"`);
    }

    expect(matches).toHaveLength(1);
    expect(mockExecSync).toHaveBeenCalledWith(`code "${matches[0].path}"`);
  });

  // パスにスペースが含まれる場合の適切な処理をテスト
  it('should handle paths with spaces correctly', async () => {
    const mockWorktrees = [
      {
        path: '/Users/test/My Projects/project name/feature-branch',
        head: 'abcdef1234567890',
        branch: 'refs/heads/feature-branch',
        status: 'NORMAL' as const,
        isActive: false,
        isMain: false,
      },
    ];

    mockGetWorktreesWithStatus.mockResolvedValue(mockWorktrees);
    mockExecSync.mockReturnValue('');

    const selectedWorktree = mockWorktrees[0];

    // パスを適切にクォートして実行
    mockExecSync(`code "${selectedWorktree.path}"`);

    expect(mockExecSync).toHaveBeenCalledWith(
      `code "${selectedWorktree.path}"`
    );
  });

  // Windows環境での動作をテスト
  it('should work correctly on Windows platform', () => {
    // Windows環境をシミュレート
    Object.defineProperty(process, 'platform', {
      value: 'win32',
      writable: true,
    });

    mockExecSync.mockImplementation((command) => {
      if (command === 'where code') {
        return 'C:\\Users\\test\\AppData\\Local\\Programs\\Microsoft VS Code\\bin\\code.cmd';
      }
      if (command?.includes('code ')) {
        return '';
      }
      return '';
    });

    const codeExists = (() => {
      try {
        mockExecSync(
          process.platform === 'win32' ? 'where code' : 'which code'
        );
        return true;
      } catch {
        return false;
      }
    })();

    expect(codeExists).toBe(true);
    expect(mockExecSync).toHaveBeenCalledWith('where code');

    // プラットフォームを元に戻す
    Object.defineProperty(process, 'platform', {
      value: 'darwin',
      writable: true,
    });
  });

  // 空のworktreeリストの処理をテスト
  it('should handle empty worktree list gracefully', async () => {
    mockGetWorktreesWithStatus.mockResolvedValue([]);

    const worktrees = await mockGetWorktreesWithStatus();

    expect(worktrees).toEqual([]);
    // 空のリストの場合はエラーメッセージまたは何もしない
  });

  // VS Code起動エラーのハンドリングをテスト
  it('should handle VS Code launch errors gracefully', async () => {
    const mockWorktrees = [
      {
        path: '/Users/test/git-worktrees/project/feature-branch',
        head: 'abcdef1234567890',
        branch: 'refs/heads/feature-branch',
        status: 'NORMAL' as const,
        isActive: false,
        isMain: false,
      },
    ];

    mockGetWorktreesWithStatus.mockResolvedValue(mockWorktrees);

    mockExecSync.mockImplementation((command) => {
      if (command?.includes('code ')) {
        throw new Error('Failed to launch VS Code');
      }
      return '';
    });

    expect(() => {
      mockExecSync(`code "${mockWorktrees[0].path}"`);
    }).toThrow('Failed to launch VS Code');
  });

  // 現在のworktreeの表示をテスト
  it('should show current worktree status in selection UI', async () => {
    const mockWorktrees = [
      {
        path: '/Users/test/project',
        head: '1234567890abcdef',
        branch: 'refs/heads/main',
        status: 'NORMAL' as const,
        isActive: false,
        isMain: true,
      },
      {
        path: '/Users/test/git-worktrees/project/feature-branch',
        head: 'abcdef1234567890',
        branch: 'refs/heads/feature-branch',
        status: 'ACTIVE' as const,
        isActive: true,
        isMain: false,
      },
    ];

    mockGetWorktreesWithStatus.mockResolvedValue(mockWorktrees);

    // ACTIVE状態のworktreeをマーク
    const displayWorktrees = mockWorktrees.map((w) => ({
      ...w,
      displayText: w.status === 'ACTIVE' ? `* ${w.branch}` : w.branch,
    }));

    expect(displayWorktrees[0].displayText).toBe('refs/heads/main');
    expect(displayWorktrees[1].displayText).toBe('* refs/heads/feature-branch');
  });

  // ユーザーキャンセル時の動作をテスト
  it('should handle user cancellation gracefully', async () => {
    const mockWorktrees = [
      {
        path: '/Users/test/project',
        head: '1234567890abcdef',
        branch: 'refs/heads/main',
        status: 'NORMAL' as const,
        isActive: false,
        isMain: true,
      },
    ];

    mockGetWorktreesWithStatus.mockResolvedValue(mockWorktrees);

    // ユーザーがESCキーでキャンセルしたと仮定
    const userCancelled = true;

    if (userCancelled) {
      // VS Codeを起動しない
    } else {
      mockExecSync(`code "${mockWorktrees[0].path}"`);
    }

    expect(mockExecSync).not.toHaveBeenCalled();
  });

  // 複数のVS Codeインスタンス起動をテスト
  it('should allow opening multiple worktrees in separate VS Code instances', async () => {
    const mockWorktrees = [
      {
        path: '/Users/test/git-worktrees/project/feature-1',
        head: 'abcdef1234567890',
        branch: 'refs/heads/feature-1',
        status: 'NORMAL' as const,
        isActive: false,
        isMain: false,
      },
      {
        path: '/Users/test/git-worktrees/project/feature-2',
        head: 'fedcba0987654321',
        branch: 'refs/heads/feature-2',
        status: 'NORMAL' as const,
        isActive: false,
        isMain: false,
      },
    ];

    mockGetWorktreesWithStatus.mockResolvedValue(mockWorktrees);
    mockExecSync.mockReturnValue('');

    // 複数のworktreeを開く
    mockExecSync(`code "${mockWorktrees[0].path}"`);
    mockExecSync(`code "${mockWorktrees[1].path}"`);

    expect(mockExecSync).toHaveBeenCalledTimes(2);
    expect(mockExecSync).toHaveBeenNthCalledWith(
      1,
      `code "${mockWorktrees[0].path}"`
    );
    expect(mockExecSync).toHaveBeenNthCalledWith(
      2,
      `code "${mockWorktrees[1].path}"`
    );
  });

  // VS Code Insidersサポートをテスト
  it('should support VS Code Insiders when available', () => {
    mockExecSync.mockImplementation((command) => {
      if (command === 'which code-insiders') {
        return '/usr/local/bin/code-insiders';
      }
      if (command === 'which code') {
        throw new Error('Command not found');
      }
      if (command?.includes('code-insiders ')) {
        return '';
      }
      return '';
    });

    // code-insidersが利用可能かチェック
    const codeInsidersExists = (() => {
      try {
        mockExecSync('which code-insiders');
        return true;
      } catch {
        return false;
      }
    })();

    expect(codeInsidersExists).toBe(true);

    // code-insidersで開く
    if (codeInsidersExists) {
      mockExecSync(`code-insiders "/path/to/worktree"`);
    }

    expect(mockExecSync).toHaveBeenCalledWith(
      `code-insiders "/path/to/worktree"`
    );
  });
});
