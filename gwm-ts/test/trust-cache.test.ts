import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { writeFileSync, mkdirSync, rmSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

// Mock homedir before importing cache module
const mockHomeDir = join(tmpdir(), 'gwm-test-home');
vi.mock('os', async () => {
  const actual = await vi.importActual<typeof import('os')>('os');
  return {
    ...actual,
    homedir: () => mockHomeDir,
  };
});

// Import after mocking
const { loadTrustCache, saveTrustCache, trustRepository, getTrustedInfo, getTrustCachePath } =
  await import('../src/trust/cache.js');

describe('TrustCache', () => {
  beforeEach(() => {
    rmSync(mockHomeDir, { recursive: true, force: true });
    mkdirSync(mockHomeDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(mockHomeDir, { recursive: true, force: true });
  });

  describe('getTrustCachePath', () => {
    it('should return path under ~/.config/gwm/', () => {
      const path = getTrustCachePath();
      expect(path).toBe(join(mockHomeDir, '.config', 'gwm', 'trusted_repos.json'));
    });
  });

  describe('loadTrustCache', () => {
    it('should return empty cache when file does not exist', () => {
      const cache = loadTrustCache();
      expect(cache).toEqual({ version: 1, repos: {} });
    });

    it('should parse valid JSON cache file', () => {
      const cacheDir = join(mockHomeDir, '.config', 'gwm');
      mkdirSync(cacheDir, { recursive: true });

      const testCache = {
        version: 1,
        repos: {
          '/test/repo': {
            configPath: '/test/repo/.gwm/config.toml',
            configHash: 'abc123',
            trustedAt: '2025-01-01T00:00:00.000Z',
            trustedCommands: ['npm install'],
          },
        },
      };

      writeFileSync(
        join(cacheDir, 'trusted_repos.json'),
        JSON.stringify(testCache)
      );

      const cache = loadTrustCache();
      expect(cache).toEqual(testCache);
    });

    it('should return empty cache on parse error', () => {
      const cacheDir = join(mockHomeDir, '.config', 'gwm');
      mkdirSync(cacheDir, { recursive: true });
      writeFileSync(join(cacheDir, 'trusted_repos.json'), 'invalid json');

      const cache = loadTrustCache();
      expect(cache).toEqual({ version: 1, repos: {} });
    });
  });

  describe('saveTrustCache', () => {
    it('should create directory if not exists', () => {
      const cache = { version: 1 as const, repos: {} };
      saveTrustCache(cache);

      const cacheDir = join(mockHomeDir, '.config', 'gwm');
      expect(existsSync(cacheDir)).toBe(true);
    });

    it('should write JSON to file', () => {
      const cache = {
        version: 1 as const,
        repos: {
          '/my/repo': {
            configPath: '/my/repo/.gwm/config.toml',
            configHash: 'xyz789',
            trustedAt: '2025-01-15T10:00:00.000Z',
            trustedCommands: ['pnpm install'],
          },
        },
      };

      saveTrustCache(cache);

      const loaded = loadTrustCache();
      expect(loaded).toEqual(cache);
    });
  });

  describe('trustRepository', () => {
    it('should add new repository to cache', () => {
      trustRepository('/new/repo', '/new/repo/.gwm/config.toml', 'hash123', [
        'npm test',
      ]);

      const info = getTrustedInfo('/new/repo');
      expect(info).not.toBeNull();
      expect(info?.configPath).toBe('/new/repo/.gwm/config.toml');
      expect(info?.configHash).toBe('hash123');
      expect(info?.trustedCommands).toEqual(['npm test']);
      expect(info?.trustedAt).toBeDefined();
    });

    it('should update existing repository', () => {
      trustRepository('/repo', '/repo/.gwm/config.toml', 'hash1', ['cmd1']);
      trustRepository('/repo', '/repo/.gwm/config.toml', 'hash2', ['cmd2']);

      const info = getTrustedInfo('/repo');
      expect(info?.configHash).toBe('hash2');
      expect(info?.trustedCommands).toEqual(['cmd2']);
    });
  });

  describe('getTrustedInfo', () => {
    it('should return null for unknown repository', () => {
      const info = getTrustedInfo('/unknown/repo');
      expect(info).toBeNull();
    });

    it('should return trusted info for known repository', () => {
      trustRepository('/known/repo', '/known/repo/.gwm/config.toml', 'hash', [
        'build',
      ]);

      const info = getTrustedInfo('/known/repo');
      expect(info).not.toBeNull();
      expect(info?.configHash).toBe('hash');
    });
  });
});
