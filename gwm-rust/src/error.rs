//! Application-wide error types for gwm.
//!
//! Uses `thiserror` for ergonomic error definitions with automatic
//! `Display` and `Error` trait implementations.

use std::path::PathBuf;
use thiserror::Error;

/// エラー解決のための提案
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Suggestion {
    /// 提案の説明
    pub description: String,
    /// 実行すべきコマンド（オプション）
    pub command: Option<String>,
}

impl Suggestion {
    /// コマンドなしの提案を作成
    pub fn new(description: impl Into<String>) -> Self {
        Self {
            description: description.into(),
            command: None,
        }
    }

    /// コマンド付きの提案を作成
    pub fn with_command(description: impl Into<String>, command: impl Into<String>) -> Self {
        Self {
            description: description.into(),
            command: Some(command.into()),
        }
    }
}

/// エラーの詳細情報
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct ErrorDetails {
    /// 関連するパス
    pub path: Option<PathBuf>,
    /// 関連するブランチ名
    pub branch: Option<String>,
    /// 変更されたファイル一覧
    pub files: Vec<String>,
    /// その他の追加情報（キーと値のペア）
    pub extra: Vec<(String, String)>,
}

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

    /// JSON serialization/deserialization error
    #[error("JSON error: {0}")]
    Json(#[from] serde_json::Error),

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

    /// このエラーに対する対処法を取得
    pub fn suggestions(&self) -> Vec<Suggestion> {
        match self {
            GwmError::NotGitRepository => vec![
                Suggestion::with_command(
                    "Navigate to a git repository",
                    "cd /path/to/your/repo",
                ),
                Suggestion::with_command("Initialize a new repository", "git init"),
            ],

            GwmError::BranchExists(branch) => vec![
                Suggestion::with_command("Use existing branch", format!("gwm go {}", branch)),
                Suggestion::with_command(
                    "Create with different name",
                    format!("gwm add {}-2", branch),
                ),
                Suggestion::with_command(
                    "Delete existing and recreate",
                    format!("git branch -D {} && gwm add {}", branch, branch),
                ),
            ],

            GwmError::BranchNotFound(branch) => vec![
                Suggestion::with_command("List available branches", "git branch -a"),
                Suggestion::with_command("Fetch from remote", "git fetch origin"),
                Suggestion::new(format!("Check if '{}' is spelled correctly", branch)),
            ],

            GwmError::UncommittedChanges { path } => {
                let name = path
                    .file_name()
                    .unwrap_or_default()
                    .to_string_lossy()
                    .to_string();
                vec![
                    Suggestion::with_command("Commit your changes", "git commit -am \"WIP\""),
                    Suggestion::with_command("Stash your changes", "git stash"),
                    Suggestion::with_command(
                        "Force delete (will lose changes)",
                        format!("gwm rm {} --force", name),
                    ),
                ]
            }

            GwmError::UnpushedCommits { path } => {
                let name = path
                    .file_name()
                    .unwrap_or_default()
                    .to_string_lossy()
                    .to_string();
                vec![
                    Suggestion::with_command("Push your commits", "git push"),
                    Suggestion::with_command(
                        "Force delete (commits will remain in reflog)",
                        format!("gwm rm {} --force", name),
                    ),
                ]
            }

            GwmError::NoRemote => vec![
                Suggestion::with_command("Add a remote origin", "git remote add origin <url>"),
                Suggestion::new("Check your network connection"),
            ],

            GwmError::Config(msg) => vec![
                Suggestion::with_command(
                    "View config file location",
                    "echo ~/.config/gwm/config.toml",
                ),
                Suggestion::new(format!("Fix the configuration error: {}", msg)),
            ],

            GwmError::WorktreeNotFound(name) => vec![
                Suggestion::with_command("List available worktrees", "gwm list"),
                Suggestion::new(format!("Check if '{}' is spelled correctly", name)),
            ],

            GwmError::GitCommand(_) => vec![
                Suggestion::new("Check if git is installed and accessible"),
                Suggestion::with_command("Verify your git version", "git --version"),
            ],

            GwmError::Trust(_) => vec![
                Suggestion::new("Review the trust settings for this repository"),
                Suggestion::with_command("Check trust configuration", "cat ~/.config/gwm/trust.json"),
            ],

            GwmError::Hook(_) => vec![
                Suggestion::new("Check your hook configuration in config.toml"),
                Suggestion::new("Verify the hook script exists and is executable"),
            ],

            _ => vec![],
        }
    }

    /// エラーの詳細情報を取得
    pub fn details(&self) -> ErrorDetails {
        match self {
            GwmError::UncommittedChanges { path } => ErrorDetails {
                path: Some(path.clone()),
                ..Default::default()
            },
            GwmError::UnpushedCommits { path } => ErrorDetails {
                path: Some(path.clone()),
                ..Default::default()
            },
            GwmError::BranchExists(branch) => ErrorDetails {
                branch: Some(branch.clone()),
                ..Default::default()
            },
            GwmError::BranchNotFound(branch) => ErrorDetails {
                branch: Some(branch.clone()),
                ..Default::default()
            },
            GwmError::WorktreeNotFound(name) => ErrorDetails {
                extra: vec![("Worktree".to_string(), name.clone())],
                ..Default::default()
            },
            _ => ErrorDetails::default(),
        }
    }

    /// ユーザーフレンドリーなエラータイトル
    pub fn title(&self) -> &'static str {
        match self {
            GwmError::NotGitRepository => "Not a git repository",
            GwmError::GitCommand(_) => "Git command failed",
            GwmError::WorktreeNotFound(_) => "Worktree not found",
            GwmError::BranchExists(_) => "Branch already exists",
            GwmError::BranchNotFound(_) => "Branch not found",
            GwmError::NoRemote => "No remote configured",
            GwmError::Config(_) => "Configuration error",
            GwmError::Io(_) => "I/O error",
            GwmError::Json(_) => "JSON error",
            GwmError::Path(_) => "Path error",
            GwmError::Trust(_) => "Trust verification failed",
            GwmError::Hook(_) => "Hook execution failed",
            GwmError::Cancelled => "Operation cancelled",
            GwmError::InvalidArgument(_) => "Invalid argument",
            GwmError::UncommittedChanges { .. } => "Uncommitted changes",
            GwmError::UnpushedCommits { .. } => "Unpushed commits",
        }
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

    #[test]
    fn test_suggestion_new() {
        let s = Suggestion::new("Test description");
        assert_eq!(s.description, "Test description");
        assert!(s.command.is_none());
    }

    #[test]
    fn test_suggestion_with_command() {
        let s = Suggestion::with_command("Run this", "git status");
        assert_eq!(s.description, "Run this");
        assert_eq!(s.command, Some("git status".to_string()));
    }

    #[test]
    fn test_error_details_default() {
        let details = ErrorDetails::default();
        assert!(details.path.is_none());
        assert!(details.branch.is_none());
        assert!(details.files.is_empty());
        assert!(details.extra.is_empty());
    }

    #[test]
    fn test_error_title_not_git_repository() {
        let err = GwmError::NotGitRepository;
        assert_eq!(err.title(), "Not a git repository");
    }

    #[test]
    fn test_error_title_branch_exists() {
        let err = GwmError::BranchExists("feature/test".to_string());
        assert_eq!(err.title(), "Branch already exists");
    }

    #[test]
    fn test_error_title_uncommitted_changes() {
        let err = GwmError::UncommittedChanges {
            path: PathBuf::from("/path/to/worktree"),
        };
        assert_eq!(err.title(), "Uncommitted changes");
    }

    #[test]
    fn test_suggestions_not_git_repository() {
        let err = GwmError::NotGitRepository;
        let suggestions = err.suggestions();
        assert_eq!(suggestions.len(), 2);
        assert_eq!(suggestions[0].description, "Navigate to a git repository");
        assert!(suggestions[0].command.is_some());
        assert_eq!(suggestions[1].description, "Initialize a new repository");
    }

    #[test]
    fn test_suggestions_branch_exists() {
        let err = GwmError::BranchExists("feature/test".to_string());
        let suggestions = err.suggestions();
        assert_eq!(suggestions.len(), 3);
        assert_eq!(suggestions[0].description, "Use existing branch");
        assert_eq!(
            suggestions[0].command,
            Some("gwm go feature/test".to_string())
        );
    }

    #[test]
    fn test_suggestions_branch_not_found() {
        let err = GwmError::BranchNotFound("feature/missing".to_string());
        let suggestions = err.suggestions();
        assert_eq!(suggestions.len(), 3);
        assert_eq!(suggestions[0].description, "List available branches");
        assert_eq!(suggestions[1].description, "Fetch from remote");
        assert!(suggestions[2].description.contains("feature/missing"));
    }

    #[test]
    fn test_suggestions_uncommitted_changes() {
        let err = GwmError::UncommittedChanges {
            path: PathBuf::from("/path/to/worktree"),
        };
        let suggestions = err.suggestions();
        assert_eq!(suggestions.len(), 3);
        assert_eq!(suggestions[0].description, "Commit your changes");
        assert_eq!(suggestions[1].description, "Stash your changes");
        assert!(suggestions[2].description.contains("Force delete"));
    }

    #[test]
    fn test_suggestions_no_remote() {
        let err = GwmError::NoRemote;
        let suggestions = err.suggestions();
        assert_eq!(suggestions.len(), 2);
        assert_eq!(suggestions[0].description, "Add a remote origin");
        assert_eq!(suggestions[1].description, "Check your network connection");
    }

    #[test]
    fn test_suggestions_cancelled_returns_empty() {
        let err = GwmError::Cancelled;
        let suggestions = err.suggestions();
        assert!(suggestions.is_empty());
    }

    #[test]
    fn test_details_uncommitted_changes() {
        let err = GwmError::UncommittedChanges {
            path: PathBuf::from("/path/to/worktree"),
        };
        let details = err.details();
        assert_eq!(details.path, Some(PathBuf::from("/path/to/worktree")));
        assert!(details.branch.is_none());
    }

    #[test]
    fn test_details_branch_exists() {
        let err = GwmError::BranchExists("feature/test".to_string());
        let details = err.details();
        assert!(details.path.is_none());
        assert_eq!(details.branch, Some("feature/test".to_string()));
    }

    #[test]
    fn test_details_worktree_not_found() {
        let err = GwmError::WorktreeNotFound("my-worktree".to_string());
        let details = err.details();
        assert!(details.path.is_none());
        assert!(details.branch.is_none());
        assert_eq!(details.extra.len(), 1);
        assert_eq!(details.extra[0], ("Worktree".to_string(), "my-worktree".to_string()));
    }

    #[test]
    fn test_details_io_error_returns_default() {
        let err = GwmError::Io(std::io::Error::new(std::io::ErrorKind::NotFound, "not found"));
        let details = err.details();
        assert!(details.path.is_none());
        assert!(details.branch.is_none());
        assert!(details.files.is_empty());
        assert!(details.extra.is_empty());
    }
}
