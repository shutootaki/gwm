import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getRepositoryName } from '../src/utils/git/index.js';
import { execSync } from 'child_process';

// child_process.execSync をモック
vi.mock('child_process', () => ({
  execSync: vi.fn(),
}));

const mockExecSync = vi.mocked(execSync);

describe('Git utilities - extended coverage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getRepositoryName', () => {
    describe('成功ケース - リモートURLの解析', () => {
      it('GitHub HTTPS URLからリポジトリ名を抽出する', () => {
        mockExecSync.mockReturnValue('https://github.com/user/my-repo.git\n');

        const result = getRepositoryName();

        expect(result).toBe('my-repo');
        expect(mockExecSync).toHaveBeenCalledWith('git remote get-url origin', {
          cwd: process.cwd(),
          encoding: 'utf8',
        });
      });

      it('GitHub SSH URLからリポジトリ名を抽出する', () => {
        mockExecSync.mockReturnValue(
          'git@github.com:user/awesome-project.git\n'
        );

        const result = getRepositoryName();

        expect(result).toBe('awesome-project');
      });

      it('.git拡張子なしのHTTPS URLからリポジトリ名を抽出する', () => {
        mockExecSync.mockReturnValue('https://github.com/org/project-name\n');

        const result = getRepositoryName();

        expect(result).toBe('project-name');
      });

      it('.git拡張子なしのSSH URLからリポジトリ名を抽出する', () => {
        mockExecSync.mockReturnValue(
          'git@github.com:organization/repository\n'
        );

        const result = getRepositoryName();

        expect(result).toBe('repository');
      });

      it('GitLab URLからリポジトリ名を抽出する', () => {
        mockExecSync.mockReturnValue(
          'https://gitlab.com/group/subgroup/project.git\n'
        );

        const result = getRepositoryName();

        expect(result).toBe('project');
      });

      it('Bitbucket URLからリポジトリ名を抽出する', () => {
        mockExecSync.mockReturnValue(
          'https://bitbucket.org/workspace/repository-name.git\n'
        );

        const result = getRepositoryName();

        expect(result).toBe('repository-name');
      });

      it('複雑なリポジトリ名（ハイフンとアンダースコア）', () => {
        mockExecSync.mockReturnValue(
          'https://github.com/user/my_awesome-project.git\n'
        );

        const result = getRepositoryName();

        expect(result).toBe('my_awesome-project');
      });
    });

    describe('フォールバック処理', () => {
      it('originリモートが存在しない場合はディレクトリ名を返す', () => {
        // process.cwdをモック
        const originalCwd = process.cwd;
        process.cwd = vi.fn().mockReturnValue('/Users/test/my-project');

        mockExecSync.mockImplementation(() => {
          throw new Error("fatal: No such remote 'origin'");
        });

        // console.warnをモック
        const consoleSpy = vi
          .spyOn(console, 'warn')
          .mockImplementation(() => {});

        const result = getRepositoryName();

        expect(result).toBe('my-project');
        expect(consoleSpy).toHaveBeenCalledWith(
          'Could not get repository name from remote, falling back to directory name'
        );

        // モックを元に戻す
        process.cwd = originalCwd;
        consoleSpy.mockRestore();
      });

      it('gitコマンドが失敗した場合はディレクトリ名を返す', () => {
        const originalCwd = process.cwd;
        process.cwd = vi
          .fn()
          .mockReturnValue('/home/user/workspace/awesome-app');

        mockExecSync.mockImplementation(() => {
          throw new Error('fatal: not a git repository');
        });

        const consoleSpy = vi
          .spyOn(console, 'warn')
          .mockImplementation(() => {});

        const result = getRepositoryName();

        expect(result).toBe('awesome-app');
        expect(consoleSpy).toHaveBeenCalled();

        process.cwd = originalCwd;
        consoleSpy.mockRestore();
      });

      it('URLの正規表現にマッチしない場合はディレクトリ名を返す', () => {
        const originalCwd = process.cwd;
        process.cwd = vi.fn().mockReturnValue('/tmp/invalid-url-repo');

        mockExecSync.mockReturnValue('invalid-url-format\n');

        const consoleSpy = vi
          .spyOn(console, 'warn')
          .mockImplementation(() => {});

        const result = getRepositoryName();

        expect(result).toBe('invalid-url-repo');
        // console.warnは実際にはcatchブロックで呼ばれるため、URLが無効でも呼ばれない
        // 実際の実装ではmatchが失敗したときは単にフォールバックするだけ

        process.cwd = originalCwd;
        consoleSpy.mockRestore();
      });

      it('現在のディレクトリが取得できない場合は"unknown"を返す', () => {
        const originalCwd = process.cwd;
        process.cwd = vi.fn().mockReturnValue('');

        mockExecSync.mockImplementation(() => {
          throw new Error('No remote');
        });

        const consoleSpy = vi
          .spyOn(console, 'warn')
          .mockImplementation(() => {});

        const result = getRepositoryName();

        expect(result).toBe('unknown');

        process.cwd = originalCwd;
        consoleSpy.mockRestore();
      });
    });

    describe('エッジケース', () => {
      it('空のリモートURLの場合', () => {
        const originalCwd = process.cwd;
        process.cwd = vi.fn().mockReturnValue('/Users/test/fallback-project');

        mockExecSync.mockReturnValue('\n');

        const consoleSpy = vi
          .spyOn(console, 'warn')
          .mockImplementation(() => {});

        const result = getRepositoryName();

        expect(result).toBe('fallback-project');

        process.cwd = originalCwd;
        consoleSpy.mockRestore();
      });

      it('スペースを含むURLの場合', () => {
        mockExecSync.mockReturnValue(
          'https://github.com/user/repo%20with%20spaces.git\n'
        );

        const result = getRepositoryName();

        expect(result).toBe('repo%20with%20spaces');
      });

      it('非常に長いリポジトリ名の場合', () => {
        const longName =
          'very-long-repository-name-that-exceeds-normal-expectations-and-continues-for-a-while';
        mockExecSync.mockReturnValue(
          `https://github.com/user/${longName}.git\n`
        );

        const result = getRepositoryName();

        expect(result).toBe(longName);
      });

      it('数字のみのリポジトリ名の場合', () => {
        mockExecSync.mockReturnValue('https://github.com/user/12345.git\n');

        const result = getRepositoryName();

        expect(result).toBe('12345');
      });

      it('特殊文字を含むリポジトリ名の場合', () => {
        mockExecSync.mockReturnValue(
          'https://github.com/user/repo.name-v2_final.git\n'
        );

        const result = getRepositoryName();

        expect(result).toBe('repo.name-v2_final');
      });
    });

    describe('プラットフォーム別のテスト', () => {
      it('Azure DevOps URLの処理', () => {
        mockExecSync.mockReturnValue(
          'https://dev.azure.com/organization/project/_git/repository\n'
        );

        const result = getRepositoryName();

        expect(result).toBe('repository');
      });

      it('GitHub Enterprise URLの処理', () => {
        mockExecSync.mockReturnValue(
          'https://github.company.com/org/private-repo.git\n'
        );

        const result = getRepositoryName();

        expect(result).toBe('private-repo');
      });

      it('CodeCommit URLの処理', () => {
        mockExecSync.mockReturnValue(
          'https://git-codecommit.us-east-1.amazonaws.com/v1/repos/my-repo\n'
        );

        const result = getRepositoryName();

        expect(result).toBe('my-repo');
      });

      it('SourceForge URLの処理', () => {
        mockExecSync.mockReturnValue(
          'https://git.code.sf.net/p/project/code\n'
        );

        const result = getRepositoryName();

        expect(result).toBe('code');
      });
    });

    describe('パフォーマンスとセキュリティ', () => {
      it('タイムアウトやエラーでも適切にフォールバックする', () => {
        const originalCwd = process.cwd;
        process.cwd = vi.fn().mockReturnValue('/var/tmp/timeout-test');

        mockExecSync.mockImplementation(() => {
          throw new Error('Command timed out');
        });

        const consoleSpy = vi
          .spyOn(console, 'warn')
          .mockImplementation(() => {});

        const result = getRepositoryName();

        expect(result).toBe('timeout-test');

        process.cwd = originalCwd;
        consoleSpy.mockRestore();
      });

      it('悪意のあるURL文字列でも安全に処理する', () => {
        const originalCwd = process.cwd;
        process.cwd = vi.fn().mockReturnValue('/secure/safe-repo');

        mockExecSync.mockReturnValue('javascript:alert("xss")\n');

        const consoleSpy = vi
          .spyOn(console, 'warn')
          .mockImplementation(() => {});

        const result = getRepositoryName();

        expect(result).toBe('safe-repo');

        process.cwd = originalCwd;
        consoleSpy.mockRestore();
      });
    });
  });
});
