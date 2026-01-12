//! Hook module type definitions.
//!
//! Types for hook execution context and results.

use std::path::PathBuf;

/// Context information for hook execution.
#[derive(Debug, Clone)]
pub struct HookContext {
    /// Absolute path to the new worktree.
    pub worktree_path: PathBuf,

    /// Name of the branch.
    pub branch_name: String,

    /// Root path of the Git repository.
    pub repo_root: PathBuf,

    /// Name of the repository.
    pub repo_name: String,
}

/// Result of hook execution.
#[derive(Debug, Clone)]
pub struct HookResult {
    /// Whether all hooks executed successfully.
    pub success: bool,

    /// Number of commands executed (including the failed one if any).
    pub executed_count: usize,

    /// The command that failed (if any).
    pub failed_command: Option<String>,

    /// Exit code of the failed command (if any).
    pub exit_code: Option<i32>,
}

impl HookResult {
    /// Create a successful result.
    pub fn success(executed_count: usize) -> Self {
        Self {
            success: true,
            executed_count,
            failed_command: None,
            exit_code: None,
        }
    }

    /// Create a failure result.
    pub fn failure(executed_count: usize, failed_command: String, exit_code: i32) -> Self {
        Self {
            success: false,
            executed_count,
            failed_command: Some(failed_command),
            exit_code: Some(exit_code),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_hook_result_success() {
        let result = HookResult::success(3);
        assert!(result.success);
        assert_eq!(result.executed_count, 3);
        assert!(result.failed_command.is_none());
        assert!(result.exit_code.is_none());
    }

    #[test]
    fn test_hook_result_failure() {
        let result = HookResult::failure(2, "npm install".to_string(), 1);
        assert!(!result.success);
        assert_eq!(result.executed_count, 2);
        assert_eq!(result.failed_command, Some("npm install".to_string()));
        assert_eq!(result.exit_code, Some(1));
    }
}
