/**
 * 候補生成のテスト
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateCandidates } from '../../../src/completion/runtime/complete.js';

// Git操作をモック
vi.mock('../../../src/utils/git/index.js', () => ({
  isGitRepository: vi.fn().mockReturnValue(true),
  getRepoRoot: vi.fn().mockReturnValue('/mock/repo'),
  getWorktreesWithStatus: vi.fn().mockResolvedValue([
    { path: '/mock/repo/main', branch: 'main', isActive: false, isMain: true },
    {
      path: '/mock/repo/feature-auth',
      branch: 'feature-auth',
      isActive: true,
      isMain: false,
    },
  ]),
  getRemoteBranchesWithInfo: vi.fn().mockResolvedValue([
    { name: 'feature-remote', lastCommitterName: 'Alice' },
    { name: 'bugfix-remote', lastCommitterName: 'Bob' },
  ]),
}));

// execAsyncをモック
vi.mock('../../../src/utils/shell.js', () => ({
  execAsync: vi.fn().mockResolvedValue({
    stdout: 'main\ndevelop\nfeature-local\n',
    stderr: '',
  }),
}));

describe('generateCandidates', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('サブコマンド補完', () => {
    it('ルート補完でサブコマンドを返す', async () => {
      const result = await generateCandidates([''], 0, 'bash');
      expect(result).toContain('list');
      expect(result).toContain('add');
      expect(result).toContain('go');
      expect(result).toContain('remove');
      expect(result).toContain('completion');
    });

    it('エイリアスも返す', async () => {
      const result = await generateCandidates([''], 0, 'bash');
      expect(result).toContain('ls');
      expect(result).toContain('rm');
    });

    it('プレフィックスでフィルタリングする', async () => {
      const result = await generateCandidates(['li'], 0, 'bash');
      expect(result).toContain('list');
      expect(result).not.toContain('add');
    });
  });

  describe('オプション補完', () => {
    it('add コマンドのオプションを返す', async () => {
      const result = await generateCandidates(['add', '--'], 1, 'bash');
      expect(result).toContain('--remote');
      expect(result).toContain('--from');
      expect(result).toContain('--code');
      expect(result).toContain('--cursor');
      expect(result).toContain('--cd');
    });

    it('remove コマンドのオプションを返す', async () => {
      const result = await generateCandidates(['remove', '--'], 1, 'bash');
      expect(result).toContain('--force');
      expect(result).toContain('--clean-branch');
    });
  });

  describe('静的オプション値補完', () => {
    it('--clean-branch の値候補を返す', async () => {
      const result = await generateCandidates(
        ['remove', '--clean-branch', ''],
        2,
        'bash'
      );
      expect(result).toContain('auto');
      expect(result).toContain('ask');
      expect(result).toContain('never');
    });

    it('completion script --shell の値候補を返す', async () => {
      const result = await generateCandidates(
        ['completion', 'script', '--shell', ''],
        3,
        'bash'
      );
      expect(result).toContain('bash');
      expect(result).toContain('zsh');
      expect(result).toContain('fish');
    });
  });

  describe('動的候補補完', () => {
    it('go コマンドでworktree候補を返す', async () => {
      const result = await generateCandidates(['go', ''], 1, 'bash');
      expect(result).toContain('main');
      expect(result).toContain('feature-auth');
    });

    it('remove コマンドでworktree候補を返す', async () => {
      const result = await generateCandidates(['remove', ''], 1, 'bash');
      expect(result).toContain('main');
      expect(result).toContain('feature-auth');
    });

    it('add --from でローカルブランチ候補を返す', async () => {
      const result = await generateCandidates(['add', '--from', ''], 2, 'bash');
      expect(result).toContain('main');
      expect(result).toContain('develop');
      expect(result).toContain('feature-local');
    });
  });

  describe('completion サブコマンド', () => {
    it('completion の後にサブコマンドを返す', async () => {
      const result = await generateCandidates(['completion', ''], 1, 'bash');
      expect(result).toContain('script');
      expect(result).toContain('install');
      expect(result).toContain('uninstall');
      expect(result).toContain('status');
    });

    it('隠しコマンドは返さない', async () => {
      const result = await generateCandidates(['completion', ''], 1, 'bash');
      expect(result).not.toContain('__complete');
      expect(result).not.toContain('__fig_worktrees');
    });
  });
});
