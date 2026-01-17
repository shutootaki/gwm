/**
 * Trusted repository information
 */
export interface TrustedRepo {
  /** Absolute path to the project config file (.gwm/config.toml or gwm/config.toml) */
  configPath: string;
  /** SHA-256 hash of the config file (hex string) */
  configHash: string;
  /** Date and time when trusted (ISO 8601 format) */
  trustedAt: string;
  /** List of trusted hook commands (for reference) */
  trustedCommands: string[];
}

/**
 * Trust cache structure
 */
export interface TrustCache {
  /** Version (for future format changes) */
  version: 1;
  /** Trust info keyed by repository root path */
  repos: Record<string, TrustedRepo>;
}

/**
 * Trust verification result
 */
export type TrustStatus =
  | { status: 'trusted' }
  | { status: 'global-config' }
  | { status: 'no-hooks' }
  | {
      status: 'needs-confirmation';
      reason: 'first-time' | 'config-changed';
      commands: string[];
      configPath: string;
      configHash: string;
    };
