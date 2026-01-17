//! Trust module type definitions.
//!
//! Types for managing trusted repositories and hook execution approval.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::{Path, PathBuf};

use crate::error::{GwmError, Result};

/// Information about a trusted repository.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TrustedRepo {
    /// Path to the project configuration file.
    pub config_path: PathBuf,

    /// SHA-256 hash of the configuration file (hex string).
    pub config_hash: String,

    /// ISO 8601 timestamp when the repository was trusted.
    pub trusted_at: String,

    /// List of trusted hook commands (for reference).
    pub trusted_commands: Vec<String>,
}

/// Trust cache structure stored in JSON format.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TrustCache {
    /// Version number for future format changes.
    pub version: u8,

    /// Map of repository root paths to trust information.
    pub repos: HashMap<String, TrustedRepo>,
}

impl Default for TrustCache {
    fn default() -> Self {
        Self {
            version: 1,
            repos: HashMap::new(),
        }
    }
}

/// Normalize a repository path for use as a cache key.
///
/// This function resolves symlinks and converts the path to an absolute path
/// to ensure consistent cache lookups regardless of how the path is accessed.
///
/// # Arguments
/// * `path` - The repository path to normalize
///
/// # Returns
/// A normalized path string suitable for use as a cache key.
///
/// # Errors
/// Returns `GwmError::Path` if the path cannot be canonicalized.
pub fn normalize_repo_path(path: &Path) -> Result<String> {
    let canonical = path.canonicalize().map_err(|e| {
        GwmError::path(format!(
            "Failed to canonicalize repository path '{}': {}",
            path.display(),
            e
        ))
    })?;

    Ok(canonical.to_string_lossy().to_string())
}

/// Try to normalize a repository path, falling back to the display string on error.
///
/// This is useful when you want best-effort normalization without failing.
pub fn normalize_repo_path_or_display(path: &Path) -> String {
    normalize_repo_path(path).unwrap_or_else(|_| path.display().to_string())
}

/// Result of trust verification.
#[derive(Debug, Clone)]
pub enum TrustStatus {
    /// Repository hooks are trusted (cached and hash matches).
    Trusted,

    /// Only global configuration is used (always trusted).
    GlobalConfig,

    /// No hooks are configured.
    NoHooks,

    /// User confirmation is required before executing hooks.
    NeedsConfirmation {
        /// Why confirmation is needed.
        reason: ConfirmationReason,
        /// Commands that will be executed.
        commands: Vec<String>,
        /// Path to the project configuration file.
        config_path: PathBuf,
        /// Current hash of the configuration file.
        config_hash: String,
    },
}

/// Reason why confirmation is required.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ConfirmationReason {
    /// First time running hooks for this repository.
    FirstTime,
    /// Configuration file has changed since last trusted.
    ConfigChanged,
}

impl ConfirmationReason {
    /// Get a human-readable description.
    pub fn description(&self) -> &'static str {
        match self {
            Self::FirstTime => "First time running hooks for this project",
            Self::ConfigChanged => "Project hook configuration has changed",
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_trust_cache_default() {
        let cache = TrustCache::default();
        assert_eq!(cache.version, 1);
        assert!(cache.repos.is_empty());
    }

    #[test]
    fn test_confirmation_reason_description() {
        assert_eq!(
            ConfirmationReason::FirstTime.description(),
            "First time running hooks for this project"
        );
        assert_eq!(
            ConfirmationReason::ConfigChanged.description(),
            "Project hook configuration has changed"
        );
    }

    #[test]
    fn test_trust_cache_serialization() {
        let mut cache = TrustCache::default();
        cache.repos.insert(
            "/path/to/repo".to_string(),
            TrustedRepo {
                config_path: PathBuf::from("/path/to/repo/.gwm/config.toml"),
                config_hash: "abc123".to_string(),
                trusted_at: "2024-01-01T00:00:00Z".to_string(),
                trusted_commands: vec!["npm install".to_string()],
            },
        );

        let json = serde_json::to_string(&cache).unwrap();
        let parsed: TrustCache = serde_json::from_str(&json).unwrap();

        assert_eq!(parsed.version, 1);
        assert!(parsed.repos.contains_key("/path/to/repo"));
    }
}
