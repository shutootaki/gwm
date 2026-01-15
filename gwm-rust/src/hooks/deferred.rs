//! Deferred hooks execution module.
//!
//! Provides functionality for deferring hook execution until after cd completes.
//! This is used by shell integration to ensure hooks run in the correct directory.

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};

use crate::error::{GwmError, Result};

use super::types::HookContext;

/// Version of the deferred hooks file format.
const DEFERRED_HOOKS_VERSION: u8 = 1;

/// Deferred hooks information stored in a temporary file.
///
/// This struct is serialized to JSON and written to a temporary file
/// when `gwm add` creates a worktree. The shell function reads this file
/// after `cd` completes and calls `gwm add --run-deferred-hooks` to execute
/// the hooks.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeferredHooks {
    /// File format version.
    pub version: u8,

    /// Absolute path to the worktree.
    pub worktree_path: PathBuf,

    /// Name of the branch.
    pub branch_name: String,

    /// Root path of the Git repository.
    pub repo_root: PathBuf,

    /// Name of the repository.
    pub repo_name: String,

    /// Hook commands to execute.
    pub commands: Vec<String>,

    /// Whether trust verification has been completed.
    ///
    /// If false, hooks should not be executed.
    pub trust_verified: bool,
}

impl DeferredHooks {
    /// Create a new DeferredHooks from context and commands.
    pub fn new(context: &HookContext, commands: Vec<String>, trust_verified: bool) -> Self {
        Self {
            version: DEFERRED_HOOKS_VERSION,
            worktree_path: context.worktree_path.clone(),
            branch_name: context.branch_name.clone(),
            repo_root: context.repo_root.clone(),
            repo_name: context.repo_name.clone(),
            commands,
            trust_verified,
        }
    }

    /// Convert to HookContext for hook execution.
    pub fn to_hook_context(&self) -> HookContext {
        HookContext {
            worktree_path: self.worktree_path.clone(),
            branch_name: self.branch_name.clone(),
            repo_root: self.repo_root.clone(),
            repo_name: self.repo_name.clone(),
        }
    }

    /// Write deferred hooks to a file.
    pub fn write_to_file(&self, path: &Path) -> Result<()> {
        let json = serde_json::to_string_pretty(self)
            .map_err(|e| GwmError::Config(format!("Failed to serialize deferred hooks: {}", e)))?;
        fs::write(path, json)
            .map_err(|e| GwmError::Config(format!("Failed to write deferred hooks file: {}", e)))?;
        Ok(())
    }

    /// Read deferred hooks from a file.
    pub fn read_from_file(path: &Path) -> Result<Self> {
        let content = fs::read_to_string(path)
            .map_err(|e| GwmError::Config(format!("Failed to read deferred hooks file: {}", e)))?;
        let hooks: DeferredHooks = serde_json::from_str(&content)
            .map_err(|e| GwmError::Config(format!("Failed to parse deferred hooks file: {}", e)))?;

        // Version check
        if hooks.version != DEFERRED_HOOKS_VERSION {
            return Err(GwmError::Config(format!(
                "Unsupported deferred hooks version: {} (expected {})",
                hooks.version, DEFERRED_HOOKS_VERSION
            )));
        }

        Ok(hooks)
    }

    /// Delete the deferred hooks file.
    pub fn delete_file(path: &Path) -> Result<()> {
        if path.exists() {
            fs::remove_file(path).map_err(|e| {
                GwmError::Config(format!("Failed to delete deferred hooks file: {}", e))
            })?;
        }
        Ok(())
    }
}

/// Get the path to the hooks file from environment variable.
pub fn hooks_file_path() -> Option<PathBuf> {
    std::env::var_os("GWM_HOOKS_FILE").map(PathBuf::from)
}

/// Try to write deferred hooks to the hooks file.
///
/// Returns true if the hooks file was written successfully.
/// Returns false if GWM_HOOKS_FILE is not set.
pub fn try_write_deferred_hooks(
    context: &HookContext,
    commands: Vec<String>,
    trust_verified: bool,
) -> Result<bool> {
    let Some(file_path) = hooks_file_path() else {
        return Ok(false);
    };

    // Only write if there are commands to execute
    if commands.is_empty() {
        return Ok(false);
    }

    let deferred = DeferredHooks::new(context, commands, trust_verified);
    deferred.write_to_file(&file_path)?;
    Ok(true)
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn test_deferred_hooks_serialization() {
        let context = HookContext {
            worktree_path: PathBuf::from("/path/to/worktree"),
            branch_name: "feature/test".to_string(),
            repo_root: PathBuf::from("/path/to/repo"),
            repo_name: "test-repo".to_string(),
        };

        let hooks = DeferredHooks::new(
            &context,
            vec!["npm install".to_string(), "npm run build".to_string()],
            true,
        );

        let json = serde_json::to_string(&hooks).unwrap();
        let parsed: DeferredHooks = serde_json::from_str(&json).unwrap();

        assert_eq!(parsed.version, DEFERRED_HOOKS_VERSION);
        assert_eq!(parsed.worktree_path, context.worktree_path);
        assert_eq!(parsed.branch_name, context.branch_name);
        assert_eq!(parsed.commands.len(), 2);
        assert!(parsed.trust_verified);
    }

    #[test]
    fn test_write_and_read_file() {
        let dir = tempdir().unwrap();
        let file_path = dir.path().join("hooks.json");

        let context = HookContext {
            worktree_path: PathBuf::from("/path/to/worktree"),
            branch_name: "feature/test".to_string(),
            repo_root: PathBuf::from("/path/to/repo"),
            repo_name: "test-repo".to_string(),
        };

        let hooks = DeferredHooks::new(&context, vec!["npm install".to_string()], true);
        hooks.write_to_file(&file_path).unwrap();

        let loaded = DeferredHooks::read_from_file(&file_path).unwrap();
        assert_eq!(loaded.branch_name, "feature/test");
        assert_eq!(loaded.commands, vec!["npm install"]);
        assert!(loaded.trust_verified);
    }

    #[test]
    fn test_to_hook_context() {
        let context = HookContext {
            worktree_path: PathBuf::from("/path/to/worktree"),
            branch_name: "feature/test".to_string(),
            repo_root: PathBuf::from("/path/to/repo"),
            repo_name: "test-repo".to_string(),
        };

        let hooks = DeferredHooks::new(&context, vec![], true);
        let converted = hooks.to_hook_context();

        assert_eq!(converted.worktree_path, context.worktree_path);
        assert_eq!(converted.branch_name, context.branch_name);
        assert_eq!(converted.repo_root, context.repo_root);
        assert_eq!(converted.repo_name, context.repo_name);
    }

    #[test]
    fn test_read_from_file_version_mismatch() {
        let dir = tempdir().unwrap();
        let file_path = dir.path().join("hooks.json");

        // Write a file with an incompatible version
        let content = r#"{
            "version": 99,
            "worktree_path": "/path/to/worktree",
            "branch_name": "test",
            "repo_root": "/path/to/repo",
            "repo_name": "repo",
            "commands": [],
            "trust_verified": true
        }"#;
        std::fs::write(&file_path, content).unwrap();

        let result = DeferredHooks::read_from_file(&file_path);
        assert!(result.is_err());
        let err = result.unwrap_err().to_string();
        assert!(
            err.contains("Unsupported deferred hooks version"),
            "Error message should mention version mismatch: {}",
            err
        );
    }

    #[test]
    fn test_read_from_file_malformed_json() {
        let dir = tempdir().unwrap();
        let file_path = dir.path().join("hooks.json");

        // Write invalid JSON
        std::fs::write(&file_path, "{ invalid json }").unwrap();

        let result = DeferredHooks::read_from_file(&file_path);
        assert!(result.is_err());
        let err = result.unwrap_err().to_string();
        assert!(
            err.contains("Failed to parse"),
            "Error message should mention parse failure: {}",
            err
        );
    }

    #[test]
    fn test_trust_verified_false_preserved() {
        // This test verifies that trust_verified: false is correctly preserved
        // through serialization/deserialization, which is critical for security
        let dir = tempdir().unwrap();
        let file_path = dir.path().join("hooks.json");

        let context = HookContext {
            worktree_path: PathBuf::from("/path/to/worktree"),
            branch_name: "feature/test".to_string(),
            repo_root: PathBuf::from("/path/to/repo"),
            repo_name: "test-repo".to_string(),
        };

        // Create hooks with trust_verified = false
        let hooks = DeferredHooks::new(&context, vec!["npm install".to_string()], false);
        assert!(!hooks.trust_verified);

        // Write and read back
        hooks.write_to_file(&file_path).unwrap();
        let loaded = DeferredHooks::read_from_file(&file_path).unwrap();

        // Verify trust_verified: false is preserved
        assert!(
            !loaded.trust_verified,
            "trust_verified: false must be preserved after serialization"
        );
    }

    #[test]
    fn test_delete_file_not_exist() {
        // 存在しないファイルの削除は成功する
        let dir = tempdir().unwrap();
        let file_path = dir.path().join("nonexistent.json");

        let result = DeferredHooks::delete_file(&file_path);
        assert!(result.is_ok());
    }

    #[test]
    fn test_delete_file_exists() {
        // 存在するファイルの削除
        let dir = tempdir().unwrap();
        let file_path = dir.path().join("hooks.json");

        // ファイルを作成
        std::fs::write(&file_path, "{}").unwrap();
        assert!(file_path.exists());

        // 削除
        let result = DeferredHooks::delete_file(&file_path);
        assert!(result.is_ok());
        assert!(!file_path.exists());
    }

    #[test]
    fn test_deferred_hooks_empty_commands() {
        // 空コマンドのシリアライズ
        let context = HookContext {
            worktree_path: PathBuf::from("/path/to/worktree"),
            branch_name: "feature/test".to_string(),
            repo_root: PathBuf::from("/path/to/repo"),
            repo_name: "test-repo".to_string(),
        };

        let hooks = DeferredHooks::new(&context, vec![], true);
        assert!(hooks.commands.is_empty());
        assert!(hooks.trust_verified);

        let json = serde_json::to_string(&hooks).unwrap();
        let parsed: DeferredHooks = serde_json::from_str(&json).unwrap();
        assert!(parsed.commands.is_empty());
    }

    #[test]
    fn test_deferred_hooks_version_constant() {
        // バージョン定数の確認
        assert_eq!(DEFERRED_HOOKS_VERSION, 1);
    }

    #[test]
    fn test_read_from_file_not_exist() {
        // 存在しないファイルの読み込みはエラー
        let result = DeferredHooks::read_from_file(Path::new("/nonexistent/hooks.json"));
        assert!(result.is_err());
    }
}
