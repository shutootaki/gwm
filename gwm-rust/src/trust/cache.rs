//! Trust cache management.
//!
//! Handles reading and writing the trusted repositories cache file.

use std::fs;
use std::path::{Path, PathBuf};

use super::types::{normalize_repo_path_or_display, TrustCache, TrustedRepo};
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
/// Returns the default cache if the file doesn't exist.
/// Logs a warning if the file exists but cannot be read or parsed.
pub fn load_cache() -> TrustCache {
    let Some(path) = get_cache_path() else {
        return TrustCache::default();
    };

    match fs::read_to_string(&path) {
        Ok(content) => match serde_json::from_str(&content) {
            Ok(cache) => cache,
            Err(e) => {
                eprintln!(
                    "\x1b[33mWarning: Failed to parse trust cache {:?}: {}\x1b[0m",
                    path, e
                );
                eprintln!("\x1b[33mUsing default trust settings.\x1b[0m");
                TrustCache::default()
            }
        },
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => TrustCache::default(),
        Err(e) => {
            eprintln!(
                "\x1b[33mWarning: Failed to read trust cache {:?}: {}\x1b[0m",
                path, e
            );
            eprintln!("\x1b[33mUsing default trust settings.\x1b[0m");
            TrustCache::default()
        }
    }
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
///
/// The repo_root path is normalized to ensure consistent cache lookups
/// regardless of symlinks or relative path usage.
pub fn trust_repository(
    repo_root: &Path,
    config_path: PathBuf,
    config_hash: String,
    commands: Vec<String>,
) -> Result<()> {
    let normalized_key = normalize_repo_path_or_display(repo_root);
    let mut cache = load_cache();
    cache.repos.insert(
        normalized_key,
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
///
/// The repo_root path is normalized for consistent cache lookups.
pub fn get_trusted_info(repo_root: &Path) -> Option<TrustedRepo> {
    let normalized_key = normalize_repo_path_or_display(repo_root);
    load_cache().repos.get(&normalized_key).cloned()
}

/// Remove trust for a repository.
///
/// The repo_root path is normalized for consistent cache lookups.
pub fn revoke_trust(repo_root: &Path) -> Result<()> {
    let normalized_key = normalize_repo_path_or_display(repo_root);
    let mut cache = load_cache();
    cache.repos.remove(&normalized_key);
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

    #[test]
    fn test_get_trusted_info_not_found() {
        // 存在しないリポジトリの情報取得
        let result = get_trusted_info(Path::new("/nonexistent/repo/12345"));
        assert!(result.is_none());
    }

    #[test]
    fn test_trust_cache_default_version() {
        let cache = TrustCache::default();
        assert_eq!(cache.version, 1);
        assert!(cache.repos.is_empty());
    }

    #[test]
    fn test_trusted_repo_with_empty_commands() {
        let repo = TrustedRepo {
            config_path: PathBuf::from("/path/to/config.toml"),
            config_hash: "hash".to_string(),
            trusted_at: "2025-01-15T00:00:00Z".to_string(),
            trusted_commands: vec![],
        };
        assert!(repo.trusted_commands.is_empty());
    }

    #[test]
    fn test_trusted_repo_multiple_commands() {
        let repo = TrustedRepo {
            config_path: PathBuf::from("/path/to/config.toml"),
            config_hash: "hash".to_string(),
            trusted_at: "2025-01-15T00:00:00Z".to_string(),
            trusted_commands: vec![
                "npm install".to_string(),
                "npm run build".to_string(),
                "npm test".to_string(),
            ],
        };
        assert_eq!(repo.trusted_commands.len(), 3);
    }
}
