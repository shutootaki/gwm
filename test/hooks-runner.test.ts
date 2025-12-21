import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { spawn } from 'child_process';
import { runPostCreateHooks } from '../src/hooks/runner/index.js';
import type { Config } from '../src/config/types.js';
import type { HookContext } from '../src/hooks/runner/types.js';

// child_process.spawn をモック
vi.mock('child_process', () => ({
  spawn: vi.fn(),
}));

const mockSpawn = vi.mocked(spawn);

// デフォルトのテスト用 context
const defaultContext: HookContext = {
  worktreePath: '/Users/test/git-worktrees/project/feature-branch',
  branchName: 'feature-branch',
  repoRoot: '/Users/test/project',
  repoName: 'project',
};

// 成功する spawn をシミュレート
function mockSpawnSuccess() {
  const mockProcess = {
    on: vi.fn((event: string, callback: (code: number) => void) => {
      if (event === 'close') {
        setTimeout(() => callback(0), 0);
      }
      return mockProcess;
    }),
  };
  mockSpawn.mockReturnValue(mockProcess as any);
}

describe('runPostCreateHooks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should return success with 0 executed count when hooks is not configured', async () => {
    const config: Config = {
      worktree_base_path: '/Users/test/git-worktrees',
      main_branches: ['main'],
      clean_branch: 'ask',
    };

    const result = await runPostCreateHooks(config, defaultContext);

    expect(result.success).toBe(true);
    expect(result.executedCount).toBe(0);
    expect(mockSpawn).not.toHaveBeenCalled();
  });

  it('should return success with 0 executed count when post_create is disabled', async () => {
    const config: Config = {
      worktree_base_path: '/Users/test/git-worktrees',
      main_branches: ['main'],
      clean_branch: 'ask',
      hooks: {
        post_create: {
          enabled: false,
          commands: ['npm install'],
        },
      },
    };

    const result = await runPostCreateHooks(config, defaultContext);

    expect(result.success).toBe(true);
    expect(result.executedCount).toBe(0);
    expect(mockSpawn).not.toHaveBeenCalled();
  });

  it('should return success with 0 executed count when commands array is empty', async () => {
    const config: Config = {
      worktree_base_path: '/Users/test/git-worktrees',
      main_branches: ['main'],
      clean_branch: 'ask',
      hooks: {
        post_create: {
          enabled: true,
          commands: [],
        },
      },
    };

    const result = await runPostCreateHooks(config, defaultContext);

    expect(result.success).toBe(true);
    expect(result.executedCount).toBe(0);
    expect(mockSpawn).not.toHaveBeenCalled();
  });

  it('should execute single command successfully', async () => {
    mockSpawnSuccess();

    const config: Config = {
      worktree_base_path: '/Users/test/git-worktrees',
      main_branches: ['main'],
      clean_branch: 'ask',
      hooks: {
        post_create: {
          enabled: true,
          commands: ['npm install'],
        },
      },
    };

    const result = await runPostCreateHooks(config, defaultContext);

    expect(result.success).toBe(true);
    expect(result.executedCount).toBe(1);
    expect(mockSpawn).toHaveBeenCalledTimes(1);
    expect(mockSpawn).toHaveBeenCalledWith(
      'npm install',
      expect.objectContaining({
        shell: true,
        cwd: defaultContext.worktreePath,
        stdio: 'inherit',
        env: expect.objectContaining({
          GWM_WORKTREE_PATH: defaultContext.worktreePath,
          GWM_BRANCH_NAME: defaultContext.branchName,
          GWM_REPO_ROOT: defaultContext.repoRoot,
          GWM_REPO_NAME: defaultContext.repoName,
        }),
      })
    );
  });

  it('should execute multiple commands sequentially', async () => {
    mockSpawnSuccess();

    const config: Config = {
      worktree_base_path: '/Users/test/git-worktrees',
      main_branches: ['main'],
      clean_branch: 'ask',
      hooks: {
        post_create: {
          enabled: true,
          commands: ['npm install', 'npm run build', 'npm test'],
        },
      },
    };

    const result = await runPostCreateHooks(config, defaultContext);

    expect(result.success).toBe(true);
    expect(result.executedCount).toBe(3);
    expect(mockSpawn).toHaveBeenCalledTimes(3);
  });

  it('should stop execution and return failure when command fails', async () => {
    // 最初のコマンドは成功、2番目で失敗
    const callCount = { count: 0 };
    mockSpawn.mockImplementation(() => {
      callCount.count++;
      const exitCode = callCount.count === 2 ? 1 : 0;
      const mockProcess = {
        on: vi.fn((event: string, callback: (code: number) => void) => {
          if (event === 'close') {
            setTimeout(() => callback(exitCode), 0);
          }
          return mockProcess;
        }),
      };
      return mockProcess as any;
    });

    const config: Config = {
      worktree_base_path: '/Users/test/git-worktrees',
      main_branches: ['main'],
      clean_branch: 'ask',
      hooks: {
        post_create: {
          enabled: true,
          commands: ['npm install', 'npm run build', 'npm test'],
        },
      },
    };

    const result = await runPostCreateHooks(config, defaultContext);

    expect(result.success).toBe(false);
    expect(result.executedCount).toBe(2); // 2番目のコマンドまで実行された（1成功 + 1失敗）
    expect(result.failedCommand).toBe('npm run build');
    expect(result.exitCode).toBe(1);
    expect(mockSpawn).toHaveBeenCalledTimes(2); // 3番目は実行されない
  });

  it('should provide GWM environment variables to commands', async () => {
    mockSpawnSuccess();

    const config: Config = {
      worktree_base_path: '/Users/test/git-worktrees',
      main_branches: ['main'],
      clean_branch: 'ask',
      hooks: {
        post_create: {
          enabled: true,
          commands: ['echo $GWM_WORKTREE_PATH'],
        },
      },
    };

    await runPostCreateHooks(config, defaultContext);

    const spawnCall = mockSpawn.mock.calls[0];
    const options = spawnCall[1] as any;

    expect(options.env.GWM_WORKTREE_PATH).toBe(
      '/Users/test/git-worktrees/project/feature-branch'
    );
    expect(options.env.GWM_BRANCH_NAME).toBe('feature-branch');
    expect(options.env.GWM_REPO_ROOT).toBe('/Users/test/project');
    expect(options.env.GWM_REPO_NAME).toBe('project');
  });

  it('should handle enabled:true being implicit (undefined)', async () => {
    mockSpawnSuccess();

    const config: Config = {
      worktree_base_path: '/Users/test/git-worktrees',
      main_branches: ['main'],
      clean_branch: 'ask',
      hooks: {
        post_create: {
          commands: ['npm install'],
        },
      },
    };

    const result = await runPostCreateHooks(config, defaultContext);

    expect(result.success).toBe(true);
    expect(result.executedCount).toBe(1);
  });
});
