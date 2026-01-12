//! Application-wide error types for gwm.
//!
//! Uses `thiserror` for ergonomic error definitions with automatic
//! `Display` and `Error` trait implementations.

use std::path::PathBuf;
use thiserror::Error;

/// The main error type for gwm operations.
#[derive(Error, Debug)]
pub enum GwmError {
    /// Not inside a Git repository
    #[error("not a git repository (or any of the parent directories)")]
    NotGitRepository,

    /// Git command execution failed
    #[error("git command failed: {0}")]
    GitCommand(String),

    /// Worktree not found
    #[error("worktree not found: {0}")]
    WorktreeNotFound(String),

    /// Branch already exists
    #[error("branch already exists: {0}")]
    BranchExists(String),

    /// Branch not found
    #[error("branch not found: {0}")]
    BranchNotFound(String),

    /// Remote not configured
    #[error("remote 'origin' is not configured")]
    NoRemote,

    /// Configuration file error
    #[error("config error: {0}")]
    Config(String),

    /// IO error
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),

    /// Path error (invalid path, home directory not found, etc.)
    #[error("path error: {0}")]
    Path(String),

    /// Trust verification failed
    #[error("trust verification failed: {0}")]
    Trust(String),

    /// Hook execution failed
    #[error("hook execution failed: {0}")]
    Hook(String),

    /// User cancelled the operation
    #[error("operation cancelled by user")]
    Cancelled,

    /// Invalid argument provided
    #[error("invalid argument: {0}")]
    InvalidArgument(String),

    /// Worktree has local changes
    #[error("worktree has uncommitted changes: {path}")]
    UncommittedChanges { path: PathBuf },

    /// Worktree has unpushed commits
    #[error("worktree has unpushed commits: {path}")]
    UnpushedCommits { path: PathBuf },
}

/// Type alias for Results using GwmError
pub type Result<T> = std::result::Result<T, GwmError>;

impl GwmError {
    /// Create a GitCommand error from a command output
    pub fn git_command(message: impl Into<String>) -> Self {
        Self::GitCommand(message.into())
    }

    /// Create a Config error
    pub fn config(message: impl Into<String>) -> Self {
        Self::Config(message.into())
    }

    /// Create a Path error
    pub fn path(message: impl Into<String>) -> Self {
        Self::Path(message.into())
    }

    /// Create a Trust error
    pub fn trust(message: impl Into<String>) -> Self {
        Self::Trust(message.into())
    }

    /// Create a Hook error
    pub fn hook(message: impl Into<String>) -> Self {
        Self::Hook(message.into())
    }

    /// Create an InvalidArgument error
    pub fn invalid_argument(message: impl Into<String>) -> Self {
        Self::InvalidArgument(message.into())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_error_display() {
        let err = GwmError::NotGitRepository;
        assert_eq!(
            err.to_string(),
            "not a git repository (or any of the parent directories)"
        );

        let err = GwmError::git_command("worktree add failed");
        assert_eq!(err.to_string(), "git command failed: worktree add failed");

        let err = GwmError::BranchExists("feature/test".to_string());
        assert_eq!(err.to_string(), "branch already exists: feature/test");
    }

    #[test]
    fn test_error_from_io() {
        let io_err = std::io::Error::new(std::io::ErrorKind::NotFound, "file not found");
        let gwm_err: GwmError = io_err.into();
        assert!(matches!(gwm_err, GwmError::Io(_)));
    }
}
