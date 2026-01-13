//! File copying utilities for worktree creation.
//!
//! Provides functionality to copy gitignored files (like `.env`) from the source
//! worktree to newly created worktrees.
//!
//! # Overview
//!
//! When a new worktree is created, certain files that are gitignored should be
//! copied from the main worktree to ensure the development environment works
//! correctly. Common examples include:
//!
//! - `.env` files with environment variables
//! - `.env.local` files with local overrides
//!
//! # Configuration
//!
//! The copy behavior is configured in `config.toml`:
//!
//! ```toml
//! [copy_ignored_files]
//! enabled = true
//! patterns = [".env", ".env.*", ".env.local", ".env.*.local"]
//! exclude_patterns = [".env.example", ".env.sample"]
//! ```
//!
//! # Pattern Matching
//!
//! - `patterns`: Glob patterns for files to include
//! - `exclude_patterns`: Glob patterns for files to exclude (takes precedence)

use std::fs;
use std::path::Path;

use glob::Pattern;

use crate::config::CopyIgnoredFilesConfig;
use crate::error::Result;

/// Result of copying gitignored files.
#[derive(Debug, Default)]
pub struct CopyResult {
    /// Files that were successfully copied.
    pub copied: Vec<String>,
    /// Files that were skipped due to exclude patterns.
    pub skipped: Vec<String>,
    /// Files that already existed in target (not overwritten).
    pub existing: Vec<String>,
    /// Files that failed to copy (with error messages).
    pub failed: Vec<(String, String)>,
}

impl CopyResult {
    /// Returns true if any files were copied.
    pub fn has_copied(&self) -> bool {
        !self.copied.is_empty()
    }

    /// Returns true if any files failed to copy.
    pub fn has_failed(&self) -> bool {
        !self.failed.is_empty()
    }

    /// Returns a summary message for display.
    pub fn summary(&self) -> String {
        let mut parts = Vec::new();

        if !self.copied.is_empty() {
            parts.push(format!(
                "Copied {} file(s): {}",
                self.copied.len(),
                self.copied.join(", ")
            ));
        }

        if !self.failed.is_empty() {
            let failed_names: Vec<_> = self.failed.iter().map(|(name, _)| name.as_str()).collect();
            parts.push(format!(
                "Failed {} file(s): {}",
                self.failed.len(),
                failed_names.join(", ")
            ));
        }

        if parts.is_empty() {
            "No files copied".to_string()
        } else {
            parts.join("; ")
        }
    }
}

/// Copy gitignored files from source worktree to target worktree.
///
/// # Arguments
///
/// * `source_worktree` - Path to the source worktree (usually the main worktree)
/// * `target_worktree` - Path to the newly created worktree
/// * `config` - Configuration for which files to copy
///
/// # Returns
///
/// A `CopyResult` containing information about copied and skipped files.
///
/// # Example
///
/// ```ignore
/// use gwm::utils::copy::copy_ignored_files;
/// use gwm::config::CopyIgnoredFilesConfig;
///
/// let config = CopyIgnoredFilesConfig::default();
/// let result = copy_ignored_files(
///     Path::new("/path/to/main"),
///     Path::new("/path/to/new-worktree"),
///     &config,
/// )?;
///
/// for file in &result.copied {
///     println!("Copied: {}", file);
/// }
/// ```
pub fn copy_ignored_files(
    source_worktree: &Path,
    target_worktree: &Path,
    config: &CopyIgnoredFilesConfig,
) -> Result<CopyResult> {
    // If copying is disabled, return empty result
    if !config.enabled {
        return Ok(CopyResult::default());
    }

    let mut result = CopyResult::default();

    // Compile include patterns
    let include_patterns: Vec<Pattern> = config
        .patterns
        .iter()
        .filter_map(|p| Pattern::new(p).ok())
        .collect();

    // Compile exclude patterns
    let exclude_patterns: Vec<Pattern> = config
        .exclude_patterns
        .iter()
        .filter_map(|p| Pattern::new(p).ok())
        .collect();

    // If no valid include patterns, return empty result
    if include_patterns.is_empty() {
        return Ok(result);
    }

    // Scan source directory for matching files
    let entries = match fs::read_dir(source_worktree) {
        Ok(entries) => entries,
        Err(_) => return Ok(result), // Source doesn't exist or isn't readable
    };

    for entry in entries.flatten() {
        let file_name = entry.file_name();
        let file_name_str = file_name.to_string_lossy();

        // Check if file matches any include pattern
        let matches_include = include_patterns.iter().any(|p| p.matches(&file_name_str));

        if !matches_include {
            continue;
        }

        // Check if file matches any exclude pattern
        let matches_exclude = exclude_patterns.iter().any(|p| p.matches(&file_name_str));

        if matches_exclude {
            result.skipped.push(file_name_str.to_string());
            continue;
        }

        // Check if it's a file (not a directory)
        let source_path = entry.path();
        if !source_path.is_file() {
            continue;
        }

        // Check if target already exists
        let target_path = target_worktree.join(&file_name);
        if target_path.exists() {
            result.existing.push(file_name_str.to_string());
            continue;
        }

        // Copy the file
        match fs::copy(&source_path, &target_path) {
            Ok(_) => result.copied.push(file_name_str.to_string()),
            Err(e) => result
                .failed
                .push((file_name_str.to_string(), e.to_string())),
        }
    }

    Ok(result)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs::File;
    use std::io::Write;
    use tempfile::TempDir;

    fn create_test_config() -> CopyIgnoredFilesConfig {
        CopyIgnoredFilesConfig {
            enabled: true,
            patterns: vec![".env".to_string(), ".env.*".to_string()],
            exclude_patterns: vec![".env.example".to_string(), ".env.sample".to_string()],
        }
    }

    #[test]
    fn test_copy_env_file() {
        let source = TempDir::new().unwrap();
        let target = TempDir::new().unwrap();

        // Create .env file in source
        let env_path = source.path().join(".env");
        let mut file = File::create(env_path).unwrap();
        writeln!(file, "API_KEY=secret").unwrap();

        let config = create_test_config();
        let result = copy_ignored_files(source.path(), target.path(), &config).unwrap();

        assert_eq!(result.copied, vec![".env"]);
        assert!(target.path().join(".env").exists());

        // Verify content was copied correctly
        let content = fs::read_to_string(target.path().join(".env")).unwrap();
        assert!(content.contains("API_KEY=secret"));
    }

    #[test]
    fn test_skip_excluded_files() {
        let source = TempDir::new().unwrap();
        let target = TempDir::new().unwrap();

        // Create .env.example in source (should be excluded)
        File::create(source.path().join(".env.example")).unwrap();

        let config = create_test_config();
        let result = copy_ignored_files(source.path(), target.path(), &config).unwrap();

        assert!(result.copied.is_empty());
        assert_eq!(result.skipped, vec![".env.example"]);
        assert!(!target.path().join(".env.example").exists());
    }

    #[test]
    fn test_skip_existing_files() {
        let source = TempDir::new().unwrap();
        let target = TempDir::new().unwrap();

        // Create .env in both source and target
        File::create(source.path().join(".env")).unwrap();
        File::create(target.path().join(".env")).unwrap();

        let config = create_test_config();
        let result = copy_ignored_files(source.path(), target.path(), &config).unwrap();

        assert!(result.copied.is_empty());
        assert_eq!(result.existing, vec![".env"]);
    }

    #[test]
    fn test_disabled_config() {
        let source = TempDir::new().unwrap();
        let target = TempDir::new().unwrap();

        File::create(source.path().join(".env")).unwrap();

        let config = CopyIgnoredFilesConfig {
            enabled: false,
            patterns: vec![".env".to_string()],
            exclude_patterns: vec![],
        };

        let result = copy_ignored_files(source.path(), target.path(), &config).unwrap();

        assert!(result.copied.is_empty());
        assert!(!target.path().join(".env").exists());
    }

    #[test]
    fn test_multiple_env_files() {
        let source = TempDir::new().unwrap();
        let target = TempDir::new().unwrap();

        // Create multiple .env files
        File::create(source.path().join(".env")).unwrap();
        File::create(source.path().join(".env.local")).unwrap();
        File::create(source.path().join(".env.development")).unwrap();
        File::create(source.path().join(".env.example")).unwrap(); // excluded

        let config = create_test_config();
        let result = copy_ignored_files(source.path(), target.path(), &config).unwrap();

        assert_eq!(result.copied.len(), 3);
        assert!(result.copied.contains(&".env".to_string()));
        assert!(result.copied.contains(&".env.local".to_string()));
        assert!(result.copied.contains(&".env.development".to_string()));
        assert_eq!(result.skipped, vec![".env.example"]);
    }

    #[test]
    fn test_copy_result_summary() {
        let mut result = CopyResult::default();
        assert_eq!(result.summary(), "No files copied");

        result.copied = vec![".env".to_string(), ".env.local".to_string()];
        assert_eq!(result.summary(), "Copied 2 file(s): .env, .env.local");
    }
}
