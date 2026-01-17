import { computeFileHash } from './hash.js';
import { getTrustedInfo } from './cache.js';
import { findExistingProjectConfigPath } from '../config/index.js';
import type { Config } from '../config/types.js';
import type { TrustStatus } from './types.js';

/**
 * Verify the trust status of project hooks
 *
 * @param repoRoot Repository root path
 * @param config Loaded configuration
 * @param hasProjectHooks Whether the project config contains hooks
 */
export function verifyTrust(
  repoRoot: string,
  config: Config,
  hasProjectHooks: boolean
): TrustStatus {
  // No hooks configured
  const commands = config.hooks?.post_create?.commands ?? [];
  if (commands.length === 0 || config.hooks?.post_create?.enabled === false) {
    return { status: 'no-hooks' };
  }

  // Hooks from global config only are always trusted
  if (!hasProjectHooks) {
    return { status: 'global-config' };
  }

  // Verify project config hooks
  const projectConfigPath = findExistingProjectConfigPath(repoRoot);

  if (!projectConfigPath) {
    // Project config file does not exist (global only)
    return { status: 'global-config' };
  }

  // Compute hash with error handling
  let currentHash: string;
  try {
    currentHash = computeFileHash(projectConfigPath);
  } catch {
    // If file read fails (e.g., race condition), treat as first-time
    return {
      status: 'needs-confirmation',
      reason: 'first-time',
      commands,
      configPath: projectConfigPath,
      configHash: '',
    };
  }

  const trustedInfo = getTrustedInfo(repoRoot);

  if (!trustedInfo) {
    // First time execution
    return {
      status: 'needs-confirmation',
      reason: 'first-time',
      commands,
      configPath: projectConfigPath,
      configHash: currentHash,
    };
  }

  if (trustedInfo.configHash !== currentHash) {
    // Config file has changed
    return {
      status: 'needs-confirmation',
      reason: 'config-changed',
      commands,
      configPath: projectConfigPath,
      configHash: currentHash,
    };
  }

  // Trusted
  return { status: 'trusted' };
}
