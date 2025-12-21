import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { writeFileSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import type { Config } from '../src/config/types.js';

// Mock homedir and setup test directories
const mockHomeDir = join(tmpdir(), 'gwm-test-verifier-home');
const mockRepoRoot = join(tmpdir(), 'gwm-test-verifier-repo');

vi.mock('os', async () => {
  const actual = await vi.importActual<typeof import('os')>('os');
  return {
    ...actual,
    homedir: () => mockHomeDir,
  };
});

// Import after mocking
const { verifyTrust } = await import('../src/trust/verifier.js');
const { trustRepository } = await import('../src/trust/cache.js');
const { computeFileHash } = await import('../src/trust/hash.js');

describe('verifyTrust', () => {
  beforeEach(() => {
    rmSync(mockHomeDir, { recursive: true, force: true });
    rmSync(mockRepoRoot, { recursive: true, force: true });
    mkdirSync(mockHomeDir, { recursive: true });
    mkdirSync(mockRepoRoot, { recursive: true });
  });

  afterEach(() => {
    rmSync(mockHomeDir, { recursive: true, force: true });
    rmSync(mockRepoRoot, { recursive: true, force: true });
  });

  const baseConfig: Config = {
    worktree_base_path: '/tmp/worktrees',
    main_branches: ['main'],
    clean_branch: 'ask',
  };

  describe('when no hooks configured', () => {
    it('should return no-hooks status when commands is empty', () => {
      const config: Config = {
        ...baseConfig,
        hooks: {
          post_create: {
            enabled: true,
            commands: [],
          },
        },
      };

      const result = verifyTrust(mockRepoRoot, config, false);
      expect(result.status).toBe('no-hooks');
    });

    it('should return no-hooks status when hooks is disabled', () => {
      const config: Config = {
        ...baseConfig,
        hooks: {
          post_create: {
            enabled: false,
            commands: ['npm install'],
          },
        },
      };

      const result = verifyTrust(mockRepoRoot, config, false);
      expect(result.status).toBe('no-hooks');
    });

    it('should return no-hooks status when hooks is undefined', () => {
      const result = verifyTrust(mockRepoRoot, baseConfig, false);
      expect(result.status).toBe('no-hooks');
    });
  });

  describe('when hooks are in global config only', () => {
    it('should return global-config status', () => {
      const config: Config = {
        ...baseConfig,
        hooks: {
          post_create: {
            enabled: true,
            commands: ['npm install'],
          },
        },
      };

      // hasProjectHooks = false means hooks come from global config
      const result = verifyTrust(mockRepoRoot, config, false);
      expect(result.status).toBe('global-config');
    });
  });

  describe('when hooks are in project config', () => {
    const configWithHooks: Config = {
      ...baseConfig,
      hooks: {
        post_create: {
          enabled: true,
          commands: ['pnpm install', 'pnpm build'],
        },
      },
    };

    it('should return needs-confirmation for first-time when no trust cache', () => {
      // Create project config file
      const gwmDir = join(mockRepoRoot, 'gwm');
      mkdirSync(gwmDir, { recursive: true });
      writeFileSync(
        join(gwmDir, 'config.toml'),
        '[hooks.post_create]\ncommands = ["pnpm install"]'
      );

      const result = verifyTrust(mockRepoRoot, configWithHooks, true);

      expect(result.status).toBe('needs-confirmation');
      if (result.status === 'needs-confirmation') {
        expect(result.reason).toBe('first-time');
        expect(result.commands).toEqual(['pnpm install', 'pnpm build']);
        expect(result.configPath).toBe(join(gwmDir, 'config.toml'));
        expect(result.configHash).toBeDefined();
      }
    });

    it('should return trusted when hash matches', () => {
      // Create project config file
      const gwmDir = join(mockRepoRoot, 'gwm');
      mkdirSync(gwmDir, { recursive: true });
      const configPath = join(gwmDir, 'config.toml');
      writeFileSync(configPath, '[hooks.post_create]\ncommands = ["pnpm install"]');

      // Trust the repository with current hash
      const hash = computeFileHash(configPath);
      trustRepository(mockRepoRoot, configPath, hash, ['pnpm install']);

      const result = verifyTrust(mockRepoRoot, configWithHooks, true);
      expect(result.status).toBe('trusted');
    });

    it('should return needs-confirmation when hash differs (config changed)', () => {
      // Create project config file
      const gwmDir = join(mockRepoRoot, 'gwm');
      mkdirSync(gwmDir, { recursive: true });
      const configPath = join(gwmDir, 'config.toml');
      writeFileSync(configPath, 'original content');

      // Trust with original hash
      const originalHash = computeFileHash(configPath);
      trustRepository(mockRepoRoot, configPath, originalHash, ['cmd']);

      // Modify the config file
      writeFileSync(configPath, 'modified content');

      const result = verifyTrust(mockRepoRoot, configWithHooks, true);

      expect(result.status).toBe('needs-confirmation');
      if (result.status === 'needs-confirmation') {
        expect(result.reason).toBe('config-changed');
      }
    });

    it('should return global-config when project config file does not exist', () => {
      // Don't create gwm/config.toml
      const result = verifyTrust(mockRepoRoot, configWithHooks, true);
      expect(result.status).toBe('global-config');
    });
  });
});
