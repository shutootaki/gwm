//! Operation summary display functions.
//!
//! Provides formatted output for operation results.

use std::time::Duration;

use crate::hooks::types::HookResult;
use crate::ui::colors::{CYAN, DIM, GREEN, RED, RESET, YELLOW};

/// Summary of a worktree add operation.
pub struct AddOperationSummary {
    /// Branch name.
    pub branch: String,

    /// Full path to the worktree.
    pub path: String,

    /// Base branch (if applicable).
    pub base_branch: Option<String>,

    /// Base commit hash (if applicable).
    pub base_commit: Option<String>,

    /// Total duration of the operation.
    pub duration: Duration,

    /// Hook execution result (if hooks were run).
    pub hooks: Option<HookResult>,

    /// Files that were copied.
    pub copied_files: Vec<String>,
}

/// Partial state of a failed operation.
#[derive(Default)]
pub struct PartialState {
    /// Whether the directory was created.
    pub directory_created: bool,

    /// Whether the branch was checked out.
    pub branch_checked_out: bool,

    /// Whether hooks completed.
    pub hooks_completed: bool,

    /// Whether files were copied.
    pub files_copied: bool,
}

impl PartialState {
    /// Create a partial state for hook failure (worktree created but hooks failed).
    pub fn hook_failed(has_copied_files: bool) -> Self {
        Self {
            directory_created: true,
            branch_checked_out: true,
            hooks_completed: false,
            files_copied: has_copied_files,
        }
    }
}

/// Print a success summary for add operation.
pub fn print_add_success_summary(summary: &AddOperationSummary) {
    println!("\n{GREEN}✓ Worktree created successfully{RESET}\n");

    println!("  Branch:    {CYAN}{}{RESET}", summary.branch);
    println!("  Path:      {CYAN}{}{RESET}", summary.path);

    if let (Some(base), Some(commit)) = (&summary.base_branch, &summary.base_commit) {
        let short_commit = if commit.len() >= 7 {
            &commit[..7]
        } else {
            commit
        };
        println!("  Base:      {} ({})", base, short_commit);
    }

    println!("  Duration:  {:.1}s", summary.duration.as_secs_f64());

    // Print hook execution details
    if let Some(ref hooks) = summary.hooks {
        if !hooks.details.is_empty() {
            println!("\n  Hooks executed:");
            for detail in &hooks.details {
                let (status, color) = if detail.success {
                    ("✓", GREEN)
                } else {
                    ("✗", RED)
                };
                println!(
                    "    {color}{status} {} ({:.1}s){RESET}",
                    detail.command,
                    detail.duration.as_secs_f64()
                );
            }
        }
    }

    // Print copied files
    if !summary.copied_files.is_empty() {
        println!("\n  Files copied:");
        for file in &summary.copied_files {
            println!("    {GREEN}✓ {file}{RESET}");
        }
    }

    // Print next steps
    println!("\n  {DIM}Next steps:{RESET}");
    println!("    cd {}", summary.path);
    println!(
        "    {DIM}# or: eval \"$(gwm go {})\"{RESET}",
        summary.branch
    );
}

/// Print an error summary for add operation.
pub fn print_add_error_summary(
    branch: &str,
    duration: Duration,
    error: &str,
    partial_state: &PartialState,
) {
    println!("\n{RED}✗ Worktree creation failed{RESET}\n");

    println!("  Branch:    {}", branch);
    println!("  Duration:  {:.1}s", duration.as_secs_f64());

    println!("\n  {RED}Error:{RESET}");
    println!("    {}", error);

    println!("\n  Partial state:");
    print_partial_state_item("Directory created", partial_state.directory_created);
    print_partial_state_item("Branch checked out", partial_state.branch_checked_out);
    print_partial_state_item("Hooks completed", partial_state.hooks_completed);
    print_partial_state_item("Files copied", partial_state.files_copied);

    println!("\n  {DIM}Recovery options:{RESET}");
    println!("    1. Fix the issue and retry");
    println!("       $ gwm add {}", branch);
    println!("    2. Remove partial worktree");
    println!("       $ gwm rm {} --force", branch);
}

fn print_partial_state_item(label: &str, completed: bool) {
    let (status, color) = if completed {
        ("✓", GREEN)
    } else {
        ("✗", RED)
    };
    println!("    {color}{status} {label}{RESET}");
}

/// Print a summary for remove operation.
pub fn print_remove_summary(removed: usize, failed: usize, duration: Duration) {
    println!();
    if failed == 0 {
        println!(
            "{GREEN}✓ Removed {} worktree(s) successfully ({:.1}s){RESET}",
            removed,
            duration.as_secs_f64()
        );
    } else {
        println!(
            "{YELLOW}⚠ Removed {} worktree(s), {} failed ({:.1}s){RESET}",
            removed,
            failed,
            duration.as_secs_f64()
        );
    }
}

/// Print a summary for clean operation.
pub fn print_clean_summary(success: usize, failed: usize, duration: Duration) {
    println!();
    if failed == 0 {
        println!(
            "{GREEN}✓ Cleaned {} worktree(s) successfully ({:.1}s){RESET}",
            success,
            duration.as_secs_f64()
        );
    } else {
        println!(
            "{YELLOW}⚠ Cleaned {} worktree(s), {} failed ({:.1}s){RESET}",
            success,
            failed,
            duration.as_secs_f64()
        );
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_partial_state_default() {
        let state = PartialState::default();
        assert!(!state.directory_created);
        assert!(!state.branch_checked_out);
        assert!(!state.hooks_completed);
        assert!(!state.files_copied);
    }

    #[test]
    fn test_add_operation_summary() {
        let summary = AddOperationSummary {
            branch: "feature/test".to_string(),
            path: "/path/to/worktree".to_string(),
            base_branch: Some("main".to_string()),
            base_commit: Some("abc1234567890".to_string()),
            duration: Duration::from_secs(3),
            hooks: None,
            copied_files: vec![".env".to_string()],
        };

        assert_eq!(summary.branch, "feature/test");
        assert_eq!(summary.path, "/path/to/worktree");
        assert_eq!(summary.base_branch, Some("main".to_string()));
    }

    #[test]
    fn test_partial_state_hook_failed_with_files() {
        let state = PartialState::hook_failed(true);
        assert!(state.directory_created);
        assert!(state.branch_checked_out);
        assert!(!state.hooks_completed);
        assert!(state.files_copied);
    }

    #[test]
    fn test_partial_state_hook_failed_without_files() {
        let state = PartialState::hook_failed(false);
        assert!(state.directory_created);
        assert!(state.branch_checked_out);
        assert!(!state.hooks_completed);
        assert!(!state.files_copied);
    }
}
