//! Hook module type definitions.
//!
//! Types for hook execution context and results.

use std::path::PathBuf;
use std::time::Duration;

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

/// Detail of a single hook command execution.
#[derive(Debug, Clone)]
pub struct HookExecutionDetail {
    /// The command that was executed.
    pub command: String,

    /// Whether the command succeeded.
    pub success: bool,

    /// Time taken to execute the command.
    pub duration: Duration,

    /// Exit code of the command (if any).
    pub exit_code: Option<i32>,

    /// Error message (if failed).
    pub error_message: Option<String>,
}

impl HookExecutionDetail {
    /// Create a successful execution detail.
    pub fn success(command: String, duration: Duration) -> Self {
        Self {
            command,
            success: true,
            duration,
            exit_code: Some(0),
            error_message: None,
        }
    }

    /// Create a failed execution detail with exit code.
    pub fn failure_with_code(command: String, duration: Duration, exit_code: i32) -> Self {
        Self {
            command,
            success: false,
            duration,
            exit_code: Some(exit_code),
            error_message: Some(format!("Exit code: {}", exit_code)),
        }
    }

    /// Create a failed execution detail with error message.
    pub fn failure_with_error(command: String, duration: Duration, error: String) -> Self {
        Self {
            command,
            success: false,
            duration,
            exit_code: Some(1),
            error_message: Some(error),
        }
    }
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

    /// Total time taken to execute all hooks.
    pub total_duration: Duration,

    /// Details of each command execution.
    pub details: Vec<HookExecutionDetail>,
}

impl HookResult {
    /// Create a successful result.
    pub fn success(executed_count: usize, total_duration: Duration, details: Vec<HookExecutionDetail>) -> Self {
        Self {
            success: true,
            executed_count,
            failed_command: None,
            exit_code: None,
            total_duration,
            details,
        }
    }

    /// Create a failure result.
    pub fn failure(
        executed_count: usize,
        failed_command: String,
        exit_code: i32,
        total_duration: Duration,
        details: Vec<HookExecutionDetail>,
    ) -> Self {
        Self {
            success: false,
            executed_count,
            failed_command: Some(failed_command),
            exit_code: Some(exit_code),
            total_duration,
            details,
        }
    }

    /// Create a result for when no hooks were configured.
    pub fn no_hooks() -> Self {
        Self {
            success: true,
            executed_count: 0,
            failed_command: None,
            exit_code: None,
            total_duration: Duration::ZERO,
            details: Vec::new(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_hook_result_success() {
        let details = vec![
            HookExecutionDetail {
                command: "npm install".to_string(),
                success: true,
                duration: Duration::from_millis(1500),
                exit_code: Some(0),
                error_message: None,
            },
            HookExecutionDetail {
                command: "npm run build".to_string(),
                success: true,
                duration: Duration::from_millis(800),
                exit_code: Some(0),
                error_message: None,
            },
        ];
        let result = HookResult::success(2, Duration::from_millis(2300), details);
        assert!(result.success);
        assert_eq!(result.executed_count, 2);
        assert!(result.failed_command.is_none());
        assert!(result.exit_code.is_none());
        assert_eq!(result.total_duration, Duration::from_millis(2300));
        assert_eq!(result.details.len(), 2);
    }

    #[test]
    fn test_hook_result_failure() {
        let details = vec![
            HookExecutionDetail {
                command: "npm install".to_string(),
                success: true,
                duration: Duration::from_millis(1500),
                exit_code: Some(0),
                error_message: None,
            },
            HookExecutionDetail {
                command: "npm run build".to_string(),
                success: false,
                duration: Duration::from_millis(200),
                exit_code: Some(1),
                error_message: Some("Build failed".to_string()),
            },
        ];
        let result = HookResult::failure(
            2,
            "npm run build".to_string(),
            1,
            Duration::from_millis(1700),
            details,
        );
        assert!(!result.success);
        assert_eq!(result.executed_count, 2);
        assert_eq!(result.failed_command, Some("npm run build".to_string()));
        assert_eq!(result.exit_code, Some(1));
        assert_eq!(result.total_duration, Duration::from_millis(1700));
        assert_eq!(result.details.len(), 2);
    }

    #[test]
    fn test_hook_result_no_hooks() {
        let result = HookResult::no_hooks();
        assert!(result.success);
        assert_eq!(result.executed_count, 0);
        assert!(result.failed_command.is_none());
        assert!(result.exit_code.is_none());
        assert_eq!(result.total_duration, Duration::ZERO);
        assert!(result.details.is_empty());
    }

    #[test]
    fn test_hook_execution_detail() {
        let detail = HookExecutionDetail {
            command: "echo hello".to_string(),
            success: true,
            duration: Duration::from_millis(50),
            exit_code: Some(0),
            error_message: None,
        };
        assert_eq!(detail.command, "echo hello");
        assert!(detail.success);
        assert_eq!(detail.duration, Duration::from_millis(50));
    }

    #[test]
    fn test_hook_execution_detail_success_helper() {
        let detail = HookExecutionDetail::success("npm install".to_string(), Duration::from_millis(1500));
        assert_eq!(detail.command, "npm install");
        assert!(detail.success);
        assert_eq!(detail.exit_code, Some(0));
        assert!(detail.error_message.is_none());
    }

    #[test]
    fn test_hook_execution_detail_failure_with_code() {
        let detail = HookExecutionDetail::failure_with_code("npm run build".to_string(), Duration::from_millis(200), 1);
        assert_eq!(detail.command, "npm run build");
        assert!(!detail.success);
        assert_eq!(detail.exit_code, Some(1));
        assert!(detail.error_message.is_some());
    }

    #[test]
    fn test_hook_execution_detail_failure_with_error() {
        let detail = HookExecutionDetail::failure_with_error(
            "invalid_cmd".to_string(),
            Duration::from_millis(10),
            "Command not found".to_string(),
        );
        assert_eq!(detail.command, "invalid_cmd");
        assert!(!detail.success);
        assert_eq!(detail.exit_code, Some(1));
        assert_eq!(detail.error_message, Some("Command not found".to_string()));
    }
}
