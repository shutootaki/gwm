//! CLI argument definitions using clap.
//!
//! This module defines all command-line arguments and subcommands for gwm.

use clap::{Parser, Subcommand};

use crate::config::CleanBranchMode;

/// gwm - Git Worktree Manager
///
/// A CLI tool for managing Git worktrees with an interactive TUI.
#[derive(Parser, Debug)]
#[command(name = "gwm")]
#[command(author = "shutootaki")]
#[command(version)]
#[command(about = "Git Worktree Manager - Manage your Git worktrees with ease")]
#[command(long_about = None)]
#[command(disable_help_subcommand = true)]
pub struct Cli {
    #[command(subcommand)]
    pub command: Option<Commands>,
}

#[derive(Subcommand, Debug)]
pub enum Commands {
    /// List all worktrees
    ///
    /// Display a table of all worktrees with their status, branch, and path.
    #[command(alias = "ls")]
    List,

    /// Add a new worktree
    ///
    /// Create a new worktree from an existing branch or create a new branch.
    /// If no branch name is provided, an interactive selector will be shown.
    Add(AddArgs),

    /// Remove worktree(s)
    ///
    /// Remove one or more worktrees. If no query is provided, an interactive
    /// multi-select interface will be shown.
    #[command(alias = "rm")]
    Remove(RemoveArgs),

    /// Navigate to a worktree
    ///
    /// Output the path of a worktree for shell integration.
    Go(GoArgs),

    /// Clean up merged/deleted worktrees
    ///
    /// Safely remove worktrees whose branches have been merged or deleted
    /// from the remote.
    Clean(CleanArgs),

    /// Update main branch worktrees
    ///
    /// Pull the latest changes for all main branch worktrees (main, master, develop).
    #[command(name = "pull-main")]
    PullMain,

    /// Show help for a command
    ///
    /// Display detailed help information for a specific command.
    Help(HelpArgs),
}

/// Arguments for the `add` command.
#[derive(Parser, Debug)]
pub struct AddArgs {
    /// Branch name to create or checkout
    ///
    /// If not provided, an interactive interface will be shown.
    #[arg()]
    pub branch_name: Option<String>,

    /// Use a remote branch
    ///
    /// Show remote branches in the interactive selector instead of creating a new branch.
    #[arg(short = 'r', long = "remote")]
    pub remote: bool,

    /// Base branch to create from
    ///
    /// Specify the branch to use as the base for the new worktree.
    /// Defaults to the current main branch.
    #[arg(long = "from")]
    pub from_branch: Option<String>,

    /// Open in VS Code after creation
    #[arg(long = "code")]
    pub open_code: bool,

    /// Open in Cursor after creation
    #[arg(long = "cursor")]
    pub open_cursor: bool,

    /// Output path only (for shell integration)
    ///
    /// Instead of opening an editor, just output the worktree path.
    #[arg(long = "cd")]
    pub output_path: bool,

    /// Skip post_create hooks
    ///
    /// Don't run the post_create hooks defined in config.
    #[arg(long = "skip-hooks")]
    pub skip_hooks: bool,
}

/// Arguments for the `remove` command.
#[derive(Parser, Debug)]
pub struct RemoveArgs {
    /// Query to filter worktrees
    ///
    /// If provided, only worktrees matching this query will be shown.
    #[arg()]
    pub query: Option<String>,

    /// Force removal even with uncommitted changes
    #[arg(short = 'f', long = "force")]
    pub force: bool,

    /// Branch cleanup mode
    ///
    /// Control whether to delete the local branch after removing the worktree.
    /// Options: auto, ask, never
    #[arg(long = "clean-branch", value_parser = parse_clean_branch_mode)]
    pub clean_branch: Option<CleanBranchMode>,
}

/// Arguments for the `go` command.
#[derive(Parser, Debug)]
pub struct GoArgs {
    /// Query to filter worktrees
    ///
    /// If provided, jump directly to the matching worktree.
    #[arg()]
    pub query: Option<String>,

    /// Open in VS Code
    #[arg(short = 'c', long = "code")]
    pub open_code: bool,

    /// Open in Cursor
    #[arg(long = "cursor")]
    pub open_cursor: bool,
}

/// Arguments for the `clean` command.
#[derive(Parser, Debug)]
pub struct CleanArgs {
    /// Dry run - show what would be cleaned without removing
    #[arg(short = 'n', long = "dry-run")]
    pub dry_run: bool,

    /// Skip confirmation prompt
    #[arg(short = 'y', long = "force")]
    pub force: bool,
}

/// Arguments for the `help` command.
#[derive(Parser, Debug)]
pub struct HelpArgs {
    /// Command to show help for
    #[arg()]
    pub command: Option<String>,
}

/// Parse clean branch mode from string.
fn parse_clean_branch_mode(s: &str) -> Result<CleanBranchMode, String> {
    match s.to_lowercase().as_str() {
        "auto" => Ok(CleanBranchMode::Auto),
        "ask" => Ok(CleanBranchMode::Ask),
        "never" => Ok(CleanBranchMode::Never),
        _ => Err(format!(
            "Invalid clean-branch mode: '{}'. Valid options: auto, ask, never",
            s
        )),
    }
}

impl Cli {
    /// Parse command line arguments.
    pub fn parse_args() -> Self {
        Self::parse()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use clap::CommandFactory;

    #[test]
    fn verify_cli() {
        // Verify that the CLI is valid
        Cli::command().debug_assert();
    }

    #[test]
    fn test_parse_add_args() {
        let cli = Cli::parse_from(["gwm", "add", "feature/test"]);
        match cli.command {
            Some(Commands::Add(args)) => {
                assert_eq!(args.branch_name, Some("feature/test".to_string()));
                assert!(!args.remote);
                assert!(!args.open_code);
            }
            _ => panic!("Expected Add command"),
        }
    }

    #[test]
    fn test_parse_add_with_flags() {
        let cli = Cli::parse_from(["gwm", "add", "-r", "--code"]);
        match cli.command {
            Some(Commands::Add(args)) => {
                assert!(args.remote);
                assert!(args.open_code);
            }
            _ => panic!("Expected Add command"),
        }
    }

    #[test]
    fn test_parse_remove_args() {
        let cli = Cli::parse_from(["gwm", "remove", "--force", "--clean-branch", "auto"]);
        match cli.command {
            Some(Commands::Remove(args)) => {
                assert!(args.force);
                assert_eq!(args.clean_branch, Some(CleanBranchMode::Auto));
            }
            _ => panic!("Expected Remove command"),
        }
    }

    #[test]
    fn test_list_alias() {
        let cli = Cli::parse_from(["gwm", "ls"]);
        assert!(matches!(cli.command, Some(Commands::List)));
    }

    #[test]
    fn test_remove_alias() {
        let cli = Cli::parse_from(["gwm", "rm"]);
        assert!(matches!(cli.command, Some(Commands::Remove(_))));
    }

    #[test]
    fn test_parse_clean_branch_mode() {
        assert_eq!(parse_clean_branch_mode("auto"), Ok(CleanBranchMode::Auto));
        assert_eq!(parse_clean_branch_mode("AUTO"), Ok(CleanBranchMode::Auto));
        assert_eq!(parse_clean_branch_mode("ask"), Ok(CleanBranchMode::Ask));
        assert_eq!(parse_clean_branch_mode("never"), Ok(CleanBranchMode::Never));
        assert!(parse_clean_branch_mode("invalid").is_err());
    }
}
