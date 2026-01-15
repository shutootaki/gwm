//! Trust cache management.
//!
//! Handles reading and writing the trusted repositories cache file.

use std::fs;
use std::path::PathBuf;

use super::types::{TrustCache, TrustedRepo};
use crate::error::Result;

/// Name of the cache file.
const CACHE_FILENAME: &str = "trusted_repos.json";

/// Get the path to the trust cache file.
///
/// Returns `~/.config/gwm/trusted_repos.json`.
pub fn get_cache_path() -> Option<PathBuf> {
    dirs::home_dir().map(|h| h.join(".config").join("gwm").join(CACHE_FILENAME))
}

/// Load the trust cache from disk.
///
/// Returns the default cache if the file doesn't exist or is invalid.
pub fn load_cache() -> TrustCache {
    get_cache_path()
        .and_then(|path| fs::read_to_string(path).ok())
        .and_then(|content| serde_json::from_str(&content).ok())
        .unwrap_or_default()
}

/// Save the trust cache to disk.
///
/// Creates the directory if it doesn't exist.
/// On Unix systems, sets file permissions to 0600 for security.
pub fn save_cache(cache: &TrustCache) -> Result<()> {
    let path = get_cache_path()
        .ok_or_else(|| crate::error::GwmError::path("Could not determine cache path"))?;

    // Create directory if needed
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }

    let content = serde_json::to_string_pretty(cache)?;

    // Write with secure permissions on Unix
    #[cfg(unix)]
    {
        use std::io::Write;
        use std::os::unix::fs::OpenOptionsExt;

        let mut file = fs::OpenOptions::new()
            .write(true)
            .create(true)
            .truncate(true)
            .mode(0o600)
            .open(&path)?;
        file.write_all(content.as_bytes())?;
    }

    #[cfg(not(unix))]
    {
        fs::write(&path, content)?;
    }

    Ok(())
}

/// Register a repository as trusted.
pub fn trust_repository(
    repo_root: &str,
    config_path: PathBuf,
    config_hash: String,
    commands: Vec<String>,
) -> Result<()> {
    let mut cache = load_cache();
    cache.repos.insert(
        repo_root.to_string(),
        TrustedRepo {
            config_path,
            config_hash,
            trusted_at: chrono::Utc::now().to_rfc3339(),
            trusted_commands: commands,
        },
    );
    save_cache(&cache)
}

/// Get trust information for a repository.
pub fn get_trusted_info(repo_root: &str) -> Option<TrustedRepo> {
    load_cache().repos.get(repo_root).cloned()
}

/// Remove trust for a repository.
pub fn revoke_trust(repo_root: &str) -> Result<()> {
    let mut cache = load_cache();
    cache.repos.remove(repo_root);
    save_cache(&cache)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_get_cache_path() {
        let path = get_cache_path();
        assert!(path.is_some());

        let path = path.unwrap();
        assert!(path.to_string_lossy().contains("gwm"));
        assert!(path.to_string_lossy().ends_with("trusted_repos.json"));
    }

    #[test]
    fn test_load_cache_default() {
        // When file doesn't exist, should return default
        let cache = load_cache();
        assert_eq!(cache.version, 1);
    }

    #[test]
    fn test_trust_cache_filename() {
        // キャッシュファイル名の確認
        assert_eq!(CACHE_FILENAME, "trusted_repos.json");
    }

    #[test]
    fn test_cache_path_contains_config() {
        // キャッシュパスに.configが含まれることを確認
        let path = get_cache_path().unwrap();
        assert!(path.to_string_lossy().contains(".config"));
    }

    #[test]
    fn test_trusted_repo_construction() {
        // TrustedRepoの構造確認
        let repo = TrustedRepo {
            config_path: PathBuf::from("/path/to/config.toml"),
            config_hash: "abc123".to_string(),
            trusted_at: "2025-01-15T00:00:00Z".to_string(),
            trusted_commands: vec!["npm install".to_string()],
        };

        assert_eq!(repo.config_path, PathBuf::from("/path/to/config.toml"));
        assert_eq!(repo.config_hash, "abc123");
        assert_eq!(repo.trusted_at, "2025-01-15T00:00:00Z");
        assert_eq!(repo.trusted_commands.len(), 1);
    }

    #[test]
    fn test_load_cache_returns_empty_repos() {
        // デフォルトキャッシュはreposが空
        let cache = TrustCache::default();
        assert!(cache.repos.is_empty());
    }
}
