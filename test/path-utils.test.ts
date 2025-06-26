import { describe, it, expect, vi, beforeEach } from 'vitest';
import { join } from 'path';
import { homedir } from 'os';
import { loadConfig } from '../src/config.js';

// 依存関数をモック化
vi.mock('os', () => ({
  homedir: vi.fn(() => '/Users/test'),
}));

vi.mock('../src/config.js', () => ({
  loadConfig: vi.fn(() => ({
    worktree_base_path: '/Users/test/worktrees',
    main_branches: ['main', 'master', 'develop']
  }))
}));

// パスユーティリティ関数のモック実装
const mockHomedir = vi.mocked(homedir);
const mockLoadConfig = vi.mocked(loadConfig);

// テスト対象の関数群（実装想定）
function normalizeWorktreeBranchName(branchName: string): string {
  return branchName.replace(/\//g, '-');
}

function getWorktreeBasePath(): string {
  const config = loadConfig();
  return config.worktree_base_path;
}

function getRepositoryName(repositoryPath: string): string {
  if (!repositoryPath) return 'unknown';
  if (repositoryPath === '/') return 'unknown';
  const parts = repositoryPath.split('/').filter(Boolean);
  return parts.length > 0 ? parts[parts.length - 1] : 'unknown';
}

function generateWorktreePath(repositoryPath: string, branchName: string): string {
  const basePath = getWorktreeBasePath();
  const repoName = getRepositoryName(repositoryPath);
  const normalizedBranchName = normalizeWorktreeBranchName(branchName);
  
  return join(basePath, repoName, normalizedBranchName);
}

function expandTildePath(path: string): string {
  if (path === '~') {
    return homedir();
  }
  if (path.startsWith('~/')) {
    return join(homedir(), path.slice(2));
  }
  return path;
}

describe('Path Generation and Normalization Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHomedir.mockReturnValue('/Users/test');
    mockLoadConfig.mockReturnValue({
      worktree_base_path: '/Users/test/worktrees',
      main_branches: ['main', 'master', 'develop']
    });
  });

  describe('normalizeWorktreeBranchName', () => {
    // ブランチ名のスラッシュをハイフンに変換するテスト
    it('should convert slashes to hyphens in branch names', () => {
      expect(normalizeWorktreeBranchName('feature/user-auth')).toBe('feature-user-auth');
      expect(normalizeWorktreeBranchName('bugfix/login-issue')).toBe('bugfix-login-issue');
      expect(normalizeWorktreeBranchName('release/v1.2.3')).toBe('release-v1.2.3');
    });

    // 複数のスラッシュを含むブランチ名のテスト
    it('should handle multiple slashes in branch names', () => {
      expect(normalizeWorktreeBranchName('team/user/feature/auth')).toBe('team-user-feature-auth');
      expect(normalizeWorktreeBranchName('feat/api/v2/endpoints')).toBe('feat-api-v2-endpoints');
    });

    // スラッシュがない場合はそのまま返すテスト
    it('should return branch name as-is when no slashes present', () => {
      expect(normalizeWorktreeBranchName('main')).toBe('main');
      expect(normalizeWorktreeBranchName('develop')).toBe('develop');
      expect(normalizeWorktreeBranchName('hotfix-urgent')).toBe('hotfix-urgent');
    });

    // 空文字列や特殊ケースのテスト
    it('should handle edge cases', () => {
      expect(normalizeWorktreeBranchName('')).toBe('');
      expect(normalizeWorktreeBranchName('/')).toBe('-');
      expect(normalizeWorktreeBranchName('//')).toBe('--');
      expect(normalizeWorktreeBranchName('feature/')).toBe('feature-');
      expect(normalizeWorktreeBranchName('/feature')).toBe('-feature');
    });
  });

  describe('getWorktreeBasePath', () => {
    // デフォルト設定のベースパス取得をテスト
    it('should return default base path from config', () => {
      const basePath = getWorktreeBasePath();
      expect(basePath).toBe('/Users/test/worktrees');
    });

    // カスタム設定のベースパス取得をテスト
    it('should return custom base path from config', () => {
      mockLoadConfig.mockReturnValue({
        worktree_base_path: '/Users/test/my-custom-worktrees',
        main_branches: ['main']
      });

      const basePath = getWorktreeBasePath();
      expect(basePath).toBe('/Users/test/my-custom-worktrees');
    });

    // チルダ記法のパス展開をテスト
    it('should handle tilde notation in base path', () => {
      mockLoadConfig.mockReturnValue({
        worktree_base_path: '~/dev/worktrees',
        main_branches: ['main']
      });

      const basePath = expandTildePath(getWorktreeBasePath());
      expect(basePath).toBe('/Users/test/dev/worktrees');
    });
  });

  describe('getRepositoryName', () => {
    // リポジトリパスからリポジトリ名を抽出するテスト
    it('should extract repository name from path', () => {
      expect(getRepositoryName('/Users/test/projects/my-app')).toBe('my-app');
      expect(getRepositoryName('/home/user/code/awesome-project')).toBe('awesome-project');
      expect(getRepositoryName('/workspace/company/product')).toBe('product');
    });

    // 末尾にスラッシュがある場合のテスト
    it('should handle paths with trailing slashes', () => {
      expect(getRepositoryName('/Users/test/projects/my-app/')).toBe('my-app');
      // 実際の実装では、空文字を避けるためのロジックが必要
    });

    // ルートディレクトリや特殊ケースのテスト
    it('should handle edge cases in repository paths', () => {
      expect(getRepositoryName('/')).toBe('unknown');
      expect(getRepositoryName('')).toBe('unknown');
      expect(getRepositoryName('single-directory')).toBe('single-directory');
    });
  });

  describe('generateWorktreePath', () => {
    // 基本的なworktreeパス生成をテスト
    it('should generate correct worktree path', () => {
      const repositoryPath = '/Users/test/projects/my-app';
      const branchName = 'feature/user-auth';
      
      const expectedPath = '/Users/test/worktrees/my-app/feature-user-auth';
      const generatedPath = generateWorktreePath(repositoryPath, branchName);
      
      expect(generatedPath).toBe(expectedPath);
    });

    // 複雑なブランチ名での生成をテスト
    it('should handle complex branch names', () => {
      const repositoryPath = '/Users/test/projects/e-commerce';
      const branchName = 'team/backend/feature/payment-integration';
      
      const expectedPath = '/Users/test/worktrees/e-commerce/team-backend-feature-payment-integration';
      const generatedPath = generateWorktreePath(repositoryPath, branchName);
      
      expect(generatedPath).toBe(expectedPath);
    });

    // カスタムベースパスでの生成をテスト
    it('should use custom base path', () => {
      mockLoadConfig.mockReturnValue({
        worktree_base_path: '/custom/path/worktrees',
        main_branches: ['main']
      });

      const repositoryPath = '/Users/test/projects/my-app';
      const branchName = 'feature-branch';
      
      const expectedPath = '/custom/path/worktrees/my-app/feature-branch';
      const generatedPath = generateWorktreePath(repositoryPath, branchName);
      
      expect(generatedPath).toBe(expectedPath);
    });

    // メインブランチでの生成をテスト
    it('should generate path for main branches', () => {
      const repositoryPath = '/Users/test/projects/my-app';
      const branchName = 'main';
      
      const expectedPath = '/Users/test/worktrees/my-app/main';
      const generatedPath = generateWorktreePath(repositoryPath, branchName);
      
      expect(generatedPath).toBe(expectedPath);
    });

    // 数字や特殊文字を含むブランチ名のテスト
    it('should handle branch names with numbers and special characters', () => {
      const repositoryPath = '/Users/test/projects/my-app';
      const branchName = 'release/v2.1.0-beta.1';
      
      const expectedPath = '/Users/test/worktrees/my-app/release-v2.1.0-beta.1';
      const generatedPath = generateWorktreePath(repositoryPath, branchName);
      
      expect(generatedPath).toBe(expectedPath);
    });
  });

  describe('expandTildePath', () => {
    // チルダ記法の展開をテスト
    it('should expand tilde notation to home directory', () => {
      expect(expandTildePath('~/worktrees')).toBe('/Users/test/worktrees');
      expect(expandTildePath('~/dev/projects')).toBe('/Users/test/dev/projects');
      expect(expandTildePath('~/.config/wtm')).toBe('/Users/test/.config/wtm');
    });

    // チルダがない場合はそのまま返すテスト
    it('should return absolute paths as-is', () => {
      expect(expandTildePath('/Users/test/worktrees')).toBe('/Users/test/worktrees');
      expect(expandTildePath('/opt/local/bin')).toBe('/opt/local/bin');
      expect(expandTildePath('relative/path')).toBe('relative/path');
    });

    // エッジケースのテスト
    it('should handle edge cases in tilde expansion', () => {
      expect(expandTildePath('~')).toBe('/Users/test');
      expect(expandTildePath('~/')).toBe('/Users/test');
      expect(expandTildePath('~something')).toBe('~something'); // 他ユーザーのホームは未対応
    });
  });

  describe('Path Validation', () => {
    // 生成されたパスの妥当性をテスト
    it('should generate valid file system paths', () => {
      const repositoryPath = '/Users/test/projects/my-app';
      const branchName = 'feature/complex-name';
      
      const generatedPath = generateWorktreePath(repositoryPath, branchName);
      
      // パスに不正な文字が含まれていないことを確認
      expect(generatedPath).not.toMatch(/[<>:"|?*]/);
      expect(generatedPath).not.toMatch(/\/\//); // 連続スラッシュがないこと
    });

    // 長いパス名の処理をテスト
    it('should handle very long branch names', () => {
      const repositoryPath = '/Users/test/projects/my-app';
      const veryLongBranchName = 'feature/' + 'a'.repeat(100) + '/very/long/nested/branch/name';
      
      const generatedPath = generateWorktreePath(repositoryPath, veryLongBranchName);
      
      expect(generatedPath).toContain('feature-' + 'a'.repeat(100) + '-very-long-nested-branch-name');
    });

    // 異なるOS環境での互換性をテスト
    it('should generate cross-platform compatible paths', () => {
      const repositoryPath = '/Users/test/projects/my-app';
      const branchName = 'feature/windows-compatibility';
      
      const generatedPath = generateWorktreePath(repositoryPath, branchName);
      
      // Windowsで問題となる文字が含まれていないことを確認
      expect(generatedPath).not.toMatch(/[<>:"|?*\\]/);
    });
  });

  describe('Configuration Integration', () => {
    // 設定ファイルとの統合をテスト
    it('should respect configuration changes', () => {
      // 初期設定
      let generatedPath = generateWorktreePath('/Users/test/projects/app', 'feature-branch');
      expect(generatedPath).toBe('/Users/test/worktrees/app/feature-branch');

      // 設定変更
      mockLoadConfig.mockReturnValue({
        worktree_base_path: '/different/path',
        main_branches: ['main']
      });

      generatedPath = generateWorktreePath('/Users/test/projects/app', 'feature-branch');
      expect(generatedPath).toBe('/different/path/app/feature-branch');
    });

    // 相対パスと絶対パスの混在テスト
    it('should handle both relative and absolute base paths', () => {
      mockLoadConfig.mockReturnValue({
        worktree_base_path: 'relative/worktrees',
        main_branches: ['main']
      });

      const generatedPath = generateWorktreePath('/Users/test/projects/app', 'feature-branch');
      expect(generatedPath).toBe('relative/worktrees/app/feature-branch');
    });
  });
});