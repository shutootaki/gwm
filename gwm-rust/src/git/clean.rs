//! Clean up merged/deleted worktrees.
//!
//! This module provides functionality to detect and clean up worktrees whose
//! branches have been:
//! - Merged into a main branch
//! - Deleted from the remote
//!
//! # Safety
//!
//! Worktrees with local changes (uncommitted changes, unpushed commits) are
//! excluded from cleanup to prevent accidental data loss.

use std::path::Path;

use crate::config::Config;
use crate::shell::exec;

use super::remote::check_remote_branch_status;
use super::types::{CleanReason, CleanableWorktree, LocalChanges, WorktreeStatus};
use super::worktree::get_worktrees;

/// Check for local changes in a worktree.
///
/// # Arguments
///
/// * `worktree_path` - Path to the worktree directory
///
/// # Returns
///
/// A `LocalChanges` struct indicating what types of changes exist.
///
/// # Safety
///
/// If git commands fail (e.g., corrupted repository, permission issues),
/// this function conservatively treats the worktree as having local changes
/// to prevent accidental data loss.
pub fn check_local_changes(worktree_path: &Path) -> LocalChanges {
    let mut result = LocalChanges::default();

    // Check git status --porcelain
    match exec("git", &["status", "--porcelain"], Some(worktree_path)) {
        Ok(output) => {
            for line in output.lines() {
                if line.starts_with("??") {
                    result.has_untracked_files = true;
                } else {
                    let chars: Vec<char> = line.chars().collect();
                    if chars.len() >= 2 {
                        // First column: staged changes
                        if chars[0] != ' ' && chars[0] != '?' {
                            result.has_staged_changes = true;
                        }
                        // Second column: unstaged changes
                        if chars[1] != ' ' && chars[1] != '?' {
                            result.has_unstaged_changes = true;
                        }
                    }
                }
            }
        }
        Err(_) => {
            // If we can't determine status safely, treat as having local changes
            // to prevent accidental data loss during cleanup
            result.has_unstaged_changes = true;
        }
    }

    // Check for unpushed commits
    // First check if there's an upstream configured
    if exec(
        "git",
        &["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{u}"],
        Some(worktree_path),
    )
    .is_ok()
    {
        // If upstream exists, check for cherry commits (local only)
        if let Ok(output) = exec("git", &["cherry", "-v"], Some(worktree_path)) {
            if !output.trim().is_empty() {
                result.has_local_commits = true;
            }
        }
    }

    result
}

/// Get all worktrees that can be safely cleaned up.
///
/// A worktree is cleanable if:
/// - It's not the MAIN or ACTIVE worktree
/// - Its branch has been merged into a main branch, OR
/// - Its remote tracking branch has been deleted
/// - It has no local changes (uncommitted, unpushed)
///
/// # Arguments
///
/// * `config` - Application configuration
///
/// # Returns
///
/// A vector of `CleanableWorktree` structs with reasons for cleanup.
pub fn get_cleanable_worktrees(config: &Config) -> Vec<CleanableWorktree> {
    let worktrees = match get_worktrees() {
        Ok(wts) => wts,
        Err(_) => return vec![],
    };

    let mut results = vec![];

    for wt in worktrees {
        // Skip MAIN/ACTIVE worktrees
        if wt.status == WorktreeStatus::Main || wt.status == WorktreeStatus::Active {
            continue;
        }

        let branch = wt.display_branch();

        // Skip if branch is a main branch
        if config.is_main_branch(branch) {
            continue;
        }

        // Check remote branch status
        let status = check_remote_branch_status(branch, &config.main_branches);

        // Only consider if remote deleted or merged
        if !status.is_deleted && !status.is_merged {
            continue;
        }

        // Check for local changes
        let local = check_local_changes(&wt.path);
        if local.has_any() {
            continue;
        }

        results.push(CleanableWorktree {
            worktree: wt,
            reason: if status.is_deleted {
                CleanReason::RemoteDeleted
            } else {
                CleanReason::Merged
            },
            merged_into: status.merged_into_branch,
        });
    }

    results
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::TempDir;

    fn create_git_repo() -> TempDir {
        let temp = TempDir::new().unwrap();
        let path = temp.path();

        // Initialize git repo
        exec("git", &["init"], Some(path)).unwrap();
        exec(
            "git",
            &["config", "user.email", "test@test.com"],
            Some(path),
        )
        .unwrap();
        exec("git", &["config", "user.name", "Test User"], Some(path)).unwrap();

        // Create initial commit
        fs::write(path.join("README.md"), "# Test").unwrap();
        exec("git", &["add", "."], Some(path)).unwrap();
        exec("git", &["commit", "-m", "Initial commit"], Some(path)).unwrap();

        temp
    }

    #[test]
    fn test_check_local_changes_clean() {
        let temp = create_git_repo();
        let changes = check_local_changes(temp.path());
        assert!(!changes.has_any());
    }

    #[test]
    fn test_check_local_changes_untracked() {
        let temp = create_git_repo();
        fs::write(temp.path().join("new_file.txt"), "content").unwrap();

        let changes = check_local_changes(temp.path());
        assert!(changes.has_untracked_files);
        assert!(!changes.has_staged_changes);
        assert!(!changes.has_unstaged_changes);
    }

    #[test]
    fn test_check_local_changes_staged() {
        let temp = create_git_repo();
        fs::write(temp.path().join("new_file.txt"), "content").unwrap();
        exec("git", &["add", "new_file.txt"], Some(temp.path())).unwrap();

        let changes = check_local_changes(temp.path());
        assert!(changes.has_staged_changes);
        assert!(!changes.has_untracked_files);
    }

    #[test]
    fn test_check_local_changes_modified() {
        let temp = create_git_repo();
        fs::write(temp.path().join("README.md"), "# Modified").unwrap();

        let changes = check_local_changes(temp.path());
        assert!(changes.has_unstaged_changes);
        assert!(!changes.has_staged_changes);
    }

    #[test]
    fn test_local_changes_summary() {
        let changes = LocalChanges {
            has_staged_changes: true,
            has_unstaged_changes: true,
            has_untracked_files: false,
            has_local_commits: false,
        };

        let summary = changes.summary();
        assert!(summary.contains(&"staged changes".to_string()));
        assert!(summary.contains(&"unstaged changes".to_string()));
        assert_eq!(summary.len(), 2);
    }
}
