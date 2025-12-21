import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { homedir } from 'os';
import type { TrustCache, TrustedRepo } from './types.js';

/**
 * Get the path to the trust cache file
 */
export function getTrustCachePath(): string {
  return join(homedir(), '.config', 'gwm', 'trusted_repos.json');
}

/**
 * Load the trust cache
 */
export function loadTrustCache(): TrustCache {
  const cachePath = getTrustCachePath();
  if (!existsSync(cachePath)) {
    return { version: 1, repos: {} };
  }
  try {
    const content = readFileSync(cachePath, 'utf8');
    return JSON.parse(content) as TrustCache;
  } catch {
    return { version: 1, repos: {} };
  }
}

/**
 * Save the trust cache
 */
export function saveTrustCache(cache: TrustCache): void {
  const cachePath = getTrustCachePath();
  const dir = dirname(cachePath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  writeFileSync(cachePath, JSON.stringify(cache, null, 2), {
    encoding: 'utf8',
    mode: 0o600, // Owner read/write only for security
  });
}

/**
 * Register a repository as trusted
 */
export function trustRepository(
  repoRoot: string,
  configPath: string,
  configHash: string,
  commands: string[]
): void {
  const cache = loadTrustCache();
  cache.repos[repoRoot] = {
    configPath,
    configHash,
    trustedAt: new Date().toISOString(),
    trustedCommands: commands,
  };
  saveTrustCache(cache);
}

/**
 * Get trusted info for a repository (returns null if not found)
 */
export function getTrustedInfo(repoRoot: string): TrustedRepo | null {
  const cache = loadTrustCache();
  return cache.repos[repoRoot] ?? null;
}
