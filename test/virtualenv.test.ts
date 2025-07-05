import { describe, it, expect, vi, beforeEach } from 'vitest';
import { existsSync, readdirSync, statSync } from 'fs';
import {
  detectVirtualEnvs,
  suggestSetupCommands,
  isVirtualEnv,
  getVirtualEnvExcludePatterns,
  VIRTUAL_ENV_PATTERNS,
} from '../src/utils/virtualenv.js';

vi.mock('fs', async (importOriginal) => {
  const actual: any = await importOriginal();
  return {
    ...(actual as any),
    existsSync: vi.fn(),
    readdirSync: vi.fn(),
    statSync: vi.fn(),
  };
});

vi.mock('../src/config.js', () => ({
  loadConfig: vi.fn(() => ({
    virtual_env_handling: {
      max_scan_depth: 5,
    },
  })),
}));

const mockExistsSync = vi.mocked(existsSync);
const mockReaddirSync = vi.mocked(readdirSync);
const mockStatSync = vi.mocked(statSync);

describe('virtualenv utilities', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('detectVirtualEnvs', () => {
    it('should return empty array if directory does not exist', () => {
      mockExistsSync.mockReturnValue(false);

      const result = detectVirtualEnvs('/non/existent/path');

      expect(result).toEqual([]);
      expect(mockReaddirSync).not.toHaveBeenCalled();
    });

    it('should detect Python virtual environments', () => {
      mockExistsSync.mockReturnValue(true);
      mockReaddirSync.mockImplementation((dir) => {
        // ルートディレクトリのみを返す
        if (dir === '/project') {
          return ['.venv', 'venv', '__pycache__', 'src', 'README.md'] as any;
        }
        return [] as any;
      });
      mockStatSync.mockImplementation((p) => {
        const path = p as string;
        return {
          isDirectory: () =>
            path.includes('.venv') ||
            path.includes('venv') ||
            path.includes('__pycache__') ||
            path.includes('src'),
        } as any;
      });

      const result = detectVirtualEnvs('/project');

      expect(result).toHaveLength(3);
      expect(result).toContainEqual({
        language: 'Python',
        path: '.venv',
        pattern: '.venv',
      });
      expect(result).toContainEqual({
        language: 'Python',
        path: 'venv',
        pattern: 'venv',
      });
      expect(result).toContainEqual({
        language: 'Python',
        path: '__pycache__',
        pattern: '__pycache__',
      });
    });

    it('should detect Node.js dependencies', () => {
      mockExistsSync.mockReturnValue(true);
      mockReaddirSync.mockImplementation((dir) => {
        // ルートディレクトリのみを返す
        if (dir === '/project') {
          return ['node_modules', 'src', 'package.json'] as any;
        }
        return [] as any;
      });
      mockStatSync.mockImplementation((p) => {
        const path = p as string;
        return {
          isDirectory: () =>
            path.includes('node_modules') || path.includes('src'),
        } as any;
      });

      const result = detectVirtualEnvs('/project');

      expect(result).toHaveLength(1);
      expect(result).toContainEqual({
        language: 'Node.js',
        path: 'node_modules',
        pattern: 'node_modules',
      });
    });

    it('should detect multiple language environments', () => {
      mockExistsSync.mockReturnValue(true);
      mockReaddirSync.mockReturnValue([
        '.venv',
        'node_modules',
        'vendor',
        'target',
        'src',
      ] as any);
      mockStatSync.mockImplementation((p) => {
        const path = p as string;
        return {
          isDirectory: () => !path.includes('src'),
        } as any;
      });

      const result = detectVirtualEnvs('/project');

      // vendorディレクトリは複数の言語で使用されるため、複数の検出結果が返される
      expect(result.length).toBeGreaterThanOrEqual(4);

      // 各言語が少なくとも1つずつ検出されることを確認
      const languages = result.map((r) => r.language);
      expect(languages).toContain('Python');
      expect(languages).toContain('Node.js');
      expect(languages).toContain('Rust');
      expect(
        languages.filter((l) => l === 'PHP' || l === 'Go' || l === 'Ruby')
          .length
      ).toBeGreaterThan(0);
    });

    it('should detect the same pattern in multiple locations', () => {
      mockExistsSync.mockReturnValue(true);
      // ルートと packages 内に node_modules が存在するケース
      mockReaddirSync.mockImplementation((dir) => {
        if (dir === '/project') {
          return ['node_modules', 'packages'] as any;
        }
        if (dir === '/project/packages') {
          return ['api', 'web'] as any;
        }
        if (dir === '/project/packages/api') {
          return ['node_modules'] as any;
        }
        if (dir === '/project/packages/web') {
          return ['node_modules'] as any;
        }
        return [] as any;
      });
      mockStatSync.mockReturnValue({
        isDirectory: () => true,
      } as any);

      const result = detectVirtualEnvs('/project');

      const nodeModulesPaths = result
        .filter((r) => r.language === 'Node.js')
        .map((r) => r.path)
        .sort();

      expect(nodeModulesPaths).toEqual(
        [
          'node_modules',
          'packages/api/node_modules',
          'packages/web/node_modules',
        ].sort()
      );
    });

    it('should handle file system errors gracefully', () => {
      mockExistsSync.mockReturnValue(true);
      mockReaddirSync.mockImplementation(() => {
        throw new Error('Permission denied');
      });

      const result = detectVirtualEnvs('/project');

      expect(result).toEqual([]);
    });
  });

  describe('suggestSetupCommands', () => {
    it('should return empty array for no detected environments', () => {
      const result = suggestSetupCommands([]);
      expect(result).toEqual([]);
    });

    it('should suggest Python setup commands', () => {
      const detectedEnvs = [
        { language: 'Python', path: '.venv', pattern: '.venv' },
      ];

      const result = suggestSetupCommands(detectedEnvs);

      expect(result).toContain('# Python: Choose one of the following:');
      expect(result).toContain('  python -m venv .venv');
      expect(result).toContain('  poetry install');
      expect(result).toContain('  pipenv install');
    });

    it('should not duplicate commands for same language', () => {
      const detectedEnvs = [
        { language: 'Python', path: '.venv', pattern: '.venv' },
        { language: 'Python', path: '__pycache__', pattern: '__pycache__' },
      ];

      const result = suggestSetupCommands(detectedEnvs);

      const pythonHeaders = result.filter((cmd) =>
        cmd.includes('# Python: Choose one of the following:')
      );
      expect(pythonHeaders).toHaveLength(1);
    });

    it('should suggest commands for multiple languages', () => {
      const detectedEnvs = [
        { language: 'Python', path: '.venv', pattern: '.venv' },
        { language: 'Node.js', path: 'node_modules', pattern: 'node_modules' },
        { language: 'Ruby', path: '.bundle', pattern: '.bundle' },
      ];

      const result = suggestSetupCommands(detectedEnvs);

      expect(result).toContain('# Python: Choose one of the following:');
      expect(result).toContain('# Node.js: Choose one of the following:');
      expect(result).toContain('# Ruby: Choose one of the following:');
      expect(result).toContain('  npm install');
      expect(result).toContain('  bundle install');
    });
  });

  describe('isVirtualEnv', () => {
    it('should identify Python virtual environments', () => {
      expect(isVirtualEnv('.venv')).toBe(true);
      expect(isVirtualEnv('venv')).toBe(true);
      expect(isVirtualEnv('.virtualenv')).toBe(true);
      expect(isVirtualEnv('env')).toBe(true);
      expect(isVirtualEnv('__pycache__')).toBe(true);
    });

    it('should identify Node.js dependencies', () => {
      expect(isVirtualEnv('node_modules')).toBe(true);
      expect(isVirtualEnv('.pnpm-store')).toBe(true);
      expect(isVirtualEnv('.yarn')).toBe(true);
    });

    it('should identify other language environments', () => {
      expect(isVirtualEnv('vendor')).toBe(true);
      expect(isVirtualEnv('target')).toBe(true);
      expect(isVirtualEnv('.bundle')).toBe(true);
      expect(isVirtualEnv('.gradle')).toBe(true);
      expect(isVirtualEnv('_build')).toBe(true);
    });

    it('should not identify regular directories', () => {
      expect(isVirtualEnv('src')).toBe(false);
      expect(isVirtualEnv('lib')).toBe(false);
      expect(isVirtualEnv('dist')).toBe(false);
      expect(isVirtualEnv('docs')).toBe(false);
    });

    it('should work with full paths', () => {
      expect(isVirtualEnv('/path/to/.venv')).toBe(true);
      expect(isVirtualEnv('/path/to/node_modules')).toBe(true);
      expect(isVirtualEnv('/path/to/src')).toBe(false);
    });
  });

  describe('getVirtualEnvExcludePatterns', () => {
    it('should return all unique patterns', () => {
      const patterns = getVirtualEnvExcludePatterns();

      expect(patterns).toContain('.venv');
      expect(patterns).toContain('node_modules');
      expect(patterns).toContain('vendor');
      expect(patterns).toContain('target');

      // 重複がないことを確認
      const uniquePatterns = new Set(patterns);
      expect(patterns.length).toBe(uniquePatterns.size);
    });

    it('should include patterns from all languages', () => {
      const patterns = getVirtualEnvExcludePatterns();
      const allPatterns = VIRTUAL_ENV_PATTERNS.flatMap((p) => p.patterns);

      for (const pattern of allPatterns) {
        expect(patterns).toContain(pattern);
      }
    });
  });
});
