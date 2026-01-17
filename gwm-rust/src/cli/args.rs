//! CLI argument definitions using clap.
//!
//! This module defines all command-line arguments and subcommands for gwm.

use clap::{Parser, Subcommand, ValueEnum};

use crate::config::CleanBranchMode;
use crate::utils::EditorType;

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
    List(ListArgs),

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

    /// Shell integration
    ///
    /// Print shell function to enable directory navigation for add/go.
    Init(InitArgs),

    /// Clean up merged/deleted worktrees
    ///
    /// Safely remove worktrees whose branches have been merged or deleted
    /// from the remote.
    Clean(CleanArgs),

    /// Sync main branch worktrees
    ///
    /// Pull the latest changes for all main branch worktrees.
    /// The main branches are configured in config.toml (defaults: main, master, develop).
    #[command(alias = "pull-main")]
    Sync,

    /// Show help for a command
    ///
    /// Display detailed help information for a specific command.
    Help(HelpArgs),

    /// Generate shell completion scripts
    ///
    /// Generate completion scripts for bash, zsh, fish, or powershell.
    /// Use --with-dynamic to enable dynamic completion for worktree names.
    Completion(CompletionArgs),
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

    /// Open in editor after creation
    ///
    /// Open the new worktree in the specified editor.
    /// Supported editors: code (VS Code), cursor, zed
    #[arg(short = 'o', long = "open", value_enum)]
    pub open: Option<EditorArg>,

    /// Open in VS Code after creation (deprecated, use --open code)
    #[arg(long = "code", hide = true)]
    pub open_code: bool,

    /// Open in Cursor after creation (deprecated, use --open cursor)
    #[arg(long = "cursor", hide = true)]
    pub open_cursor: bool,

    /// Show success message instead of path output
    ///
    /// Disable the default path-only output and show interactive success message.
    #[arg(long = "no-cd")]
    pub no_cd: bool,

    /// Skip post_create hooks
    ///
    /// Don't run the post_create hooks defined in config.
    #[arg(long = "skip-hooks")]
    pub skip_hooks: bool,

    /// Execute deferred hooks from a file (internal use)
    ///
    /// This option is used by shell integration to execute hooks after cd completes.
    /// Not intended for direct user use.
    #[arg(long = "run-deferred-hooks", hide = true)]
    pub run_deferred_hooks: Option<String>,
}

impl AddArgs {
    /// Check if any editor option is specified.
    fn has_editor_option(&self) -> bool {
        self.open.is_some() || self.open_code || self.open_cursor
    }

    /// Get the editor to open (with deprecation warnings for legacy options).
    ///
    /// Returns the editor type if any editor option is specified.
    /// Shows a deprecation warning if the legacy --code or --cursor flags are used.
    pub fn editor(&self) -> Option<EditorType> {
        if let Some(editor) = self.open {
            return Some(editor.to_editor_type());
        }
        if self.open_code {
            eprintln!("\x1b[33mWarning: --code is deprecated. Use --open code instead.\x1b[0m");
            return Some(EditorType::VsCode);
        }
        if self.open_cursor {
            eprintln!("\x1b[33mWarning: --cursor is deprecated. Use --open cursor instead.\x1b[0m");
            return Some(EditorType::Cursor);
        }
        None
    }

    /// Calculate the effective output_path flag.
    ///
    /// Returns true (path-only output) when:
    /// - --no-cd is NOT specified
    /// - No editor option (--open, --code, --cursor) is specified
    pub fn should_output_path_only(&self) -> bool {
        !self.no_cd && !self.has_editor_option()
    }
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

    /// Open in editor
    ///
    /// Open the worktree in the specified editor.
    /// Supported editors: code (VS Code), cursor, zed
    #[arg(short = 'o', long = "open", value_enum)]
    pub open: Option<EditorArg>,

    /// Open in VS Code (deprecated, use --open code)
    #[arg(short = 'c', long = "code", hide = true)]
    pub open_code: bool,

    /// Open in Cursor (deprecated, use --open cursor)
    #[arg(long = "cursor", hide = true)]
    pub open_cursor: bool,

    /// Show success message instead of path output
    ///
    /// Disable the default path-only output and show interactive success message.
    #[arg(long = "no-cd")]
    pub no_cd: bool,
}

impl GoArgs {
    /// Check if any editor option is specified.
    fn has_editor_option(&self) -> bool {
        self.open.is_some() || self.open_code || self.open_cursor
    }

    /// Get the editor to open (with deprecation warnings for legacy options).
    ///
    /// Returns the editor type if any editor option is specified.
    /// Shows a deprecation warning if the legacy --code or --cursor flags are used.
    pub fn editor(&self) -> Option<EditorType> {
        if let Some(editor) = self.open {
            return Some(editor.to_editor_type());
        }
        if self.open_code {
            eprintln!("\x1b[33mWarning: --code is deprecated. Use --open code instead.\x1b[0m");
            return Some(EditorType::VsCode);
        }
        if self.open_cursor {
            eprintln!("\x1b[33mWarning: --cursor is deprecated. Use --open cursor instead.\x1b[0m");
            return Some(EditorType::Cursor);
        }
        None
    }

    /// Calculate the effective output_path flag.
    ///
    /// Returns true (path-only output) when:
    /// - --no-cd is NOT specified
    /// - No editor option (--open, --code, --cursor) is specified
    pub fn should_output_path_only(&self) -> bool {
        !self.no_cd && !self.has_editor_option()
    }
}

/// Arguments for the `init` command.
#[derive(Parser, Debug)]
pub struct InitArgs {
    /// Shell type (bash, zsh, fish)
    #[arg(value_enum)]
    pub shell: ShellType,
}

/// Shell types supported by `gwm init`.
#[derive(ValueEnum, Debug, Clone, Copy, PartialEq, Eq)]
pub enum ShellType {
    Bash,
    Zsh,
    Fish,
}

/// Editor types for `--open` option.
///
/// Used by `add` and `go` commands to open the worktree in an editor.
#[derive(ValueEnum, Debug, Clone, Copy, PartialEq, Eq)]
pub enum EditorArg {
    /// VS Code (also accepts "vscode")
    #[value(alias = "vscode")]
    Code,
    /// Cursor
    Cursor,
    /// Zed
    Zed,
}

impl EditorArg {
    /// Convert to EditorType for editor operations.
    pub fn to_editor_type(self) -> EditorType {
        match self {
            EditorArg::Code => EditorType::VsCode,
            EditorArg::Cursor => EditorType::Cursor,
            EditorArg::Zed => EditorType::Zed,
        }
    }
}

/// Arguments for the `clean` command.
#[derive(Parser, Debug)]
pub struct CleanArgs {
    /// Dry run - show what would be cleaned without removing
    #[arg(short = 'n', long = "dry-run")]
    pub dry_run: bool,

    /// Skip confirmation prompt
    #[arg(long = "force")]
    pub force: bool,
}

/// Arguments for the `help` command.
#[derive(Parser, Debug)]
pub struct HelpArgs {
    /// Command to show help for
    #[arg()]
    pub command: Option<String>,
}

/// Arguments for the `completion` command.
#[derive(Parser, Debug)]
pub struct CompletionArgs {
    /// Shell type (bash, zsh, fish)
    #[arg(value_enum)]
    pub shell: CompletionShell,

    /// Enable dynamic completion for worktree names
    ///
    /// When enabled, the completion script will call gwm to get
    /// real-time worktree suggestions.
    #[arg(long = "with-dynamic")]
    pub with_dynamic: bool,
}

/// Shell types supported by `gwm completion`.
#[derive(ValueEnum, Debug, Clone, Copy, PartialEq, Eq)]
pub enum CompletionShell {
    Bash,
    Zsh,
    Fish,
}

/// Arguments for the `list` command.
#[derive(Parser, Debug, Default)]
pub struct ListArgs {
    /// Use compact format (legacy layout without SYNC/CHANGES/ACTIVITY)
    #[arg(long)]
    pub compact: bool,

    /// Output format (table or json)
    ///
    /// Use `table` for human-readable colored output (default),
    /// or `json` for scripting and automation.
    #[arg(long, value_enum, default_value = "table")]
    pub format: OutputFormat,
}

/// Output format for the list command
#[derive(ValueEnum, Debug, Clone, Copy, PartialEq, Eq, Default)]
pub enum OutputFormat {
    /// Table format with colors (default)
    #[default]
    Table,
    /// JSON format for scripting
    Json,
    /// Names only (for shell completion)
    Names,
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
    fn test_parse_init_args() {
        let cli = Cli::parse_from(["gwm", "init", "bash"]);
        match cli.command {
            Some(Commands::Init(args)) => assert_eq!(args.shell, ShellType::Bash),
            _ => panic!("Expected Init command"),
        }
    }

    #[test]
    fn test_list_alias_ls() {
        let cli = Cli::parse_from(["gwm", "ls"]);
        assert!(matches!(cli.command, Some(Commands::List(_))));
    }

    #[test]
    fn test_list_compact_flag() {
        let cli = Cli::parse_from(["gwm", "list", "--compact"]);
        if let Some(Commands::List(args)) = cli.command {
            assert!(args.compact);
        } else {
            panic!("Expected List command");
        }
    }

    #[test]
    fn test_list_json_format() {
        let cli = Cli::parse_from(["gwm", "list", "--format", "json"]);
        if let Some(Commands::List(args)) = cli.command {
            assert_eq!(args.format, OutputFormat::Json);
        } else {
            panic!("Expected List command");
        }
    }

    #[test]
    fn test_remove_alias_rm() {
        let cli = Cli::parse_from(["gwm", "rm"]);
        assert!(matches!(cli.command, Some(Commands::Remove(_))));
    }

    #[test]
    fn test_sync_command() {
        let cli = Cli::parse_from(["gwm", "sync"]);
        assert!(matches!(cli.command, Some(Commands::Sync)));
    }

    #[test]
    fn test_sync_alias_pull_main() {
        // Backward compatibility: pull-main should still work
        let cli = Cli::parse_from(["gwm", "pull-main"]);
        assert!(matches!(cli.command, Some(Commands::Sync)));
    }

    #[test]
    fn test_parse_clean_branch_mode() {
        assert_eq!(parse_clean_branch_mode("auto"), Ok(CleanBranchMode::Auto));
        assert_eq!(parse_clean_branch_mode("AUTO"), Ok(CleanBranchMode::Auto));
        assert_eq!(parse_clean_branch_mode("ask"), Ok(CleanBranchMode::Ask));
        assert_eq!(parse_clean_branch_mode("never"), Ok(CleanBranchMode::Never));
        assert!(parse_clean_branch_mode("invalid").is_err());
    }

    #[test]
    fn test_add_should_output_path_only() {
        // Default: should output path only
        let cli = Cli::parse_from(["gwm", "add", "feature/test"]);
        if let Some(Commands::Add(args)) = cli.command {
            assert!(args.should_output_path_only());
        }

        // --no-cd: should NOT output path only
        let cli = Cli::parse_from(["gwm", "add", "feature/test", "--no-cd"]);
        if let Some(Commands::Add(args)) = cli.command {
            assert!(!args.should_output_path_only());
        }

        // --code: should NOT output path only
        let cli = Cli::parse_from(["gwm", "add", "feature/test", "--code"]);
        if let Some(Commands::Add(args)) = cli.command {
            assert!(!args.should_output_path_only());
        }

        // --cursor: should NOT output path only
        let cli = Cli::parse_from(["gwm", "add", "feature/test", "--cursor"]);
        if let Some(Commands::Add(args)) = cli.command {
            assert!(!args.should_output_path_only());
        }
    }

    #[test]
    fn test_go_should_output_path_only() {
        // Default: should output path only
        let cli = Cli::parse_from(["gwm", "go", "feature/test"]);
        if let Some(Commands::Go(args)) = cli.command {
            assert!(
                args.should_output_path_only(),
                "Default go should output path only"
            );
        }

        // --no-cd: should NOT output path only
        let cli = Cli::parse_from(["gwm", "go", "feature/test", "--no-cd"]);
        if let Some(Commands::Go(args)) = cli.command {
            assert!(
                !args.should_output_path_only(),
                "--no-cd should disable path-only output"
            );
        }

        // --code: should NOT output path only
        let cli = Cli::parse_from(["gwm", "go", "feature/test", "--code"]);
        if let Some(Commands::Go(args)) = cli.command {
            assert!(
                !args.should_output_path_only(),
                "--code should disable path-only output"
            );
        }

        // --cursor: should NOT output path only
        let cli = Cli::parse_from(["gwm", "go", "feature/test", "--cursor"]);
        if let Some(Commands::Go(args)) = cli.command {
            assert!(
                !args.should_output_path_only(),
                "--cursor should disable path-only output"
            );
        }
    }

    #[test]
    fn test_editor_arg_to_editor_type() {
        assert_eq!(EditorArg::Code.to_editor_type(), EditorType::VsCode);
        assert_eq!(EditorArg::Cursor.to_editor_type(), EditorType::Cursor);
        assert_eq!(EditorArg::Zed.to_editor_type(), EditorType::Zed);
    }

    #[test]
    fn test_parse_add_with_open_option() {
        let cli = Cli::parse_from(["gwm", "add", "test", "--open", "code"]);
        if let Some(Commands::Add(args)) = cli.command {
            assert_eq!(args.open, Some(EditorArg::Code));
            assert!(!args.should_output_path_only());
        } else {
            panic!("Expected Add command");
        }
    }

    #[test]
    fn test_parse_add_with_open_short_form() {
        let cli = Cli::parse_from(["gwm", "add", "test", "-o", "zed"]);
        if let Some(Commands::Add(args)) = cli.command {
            assert_eq!(args.open, Some(EditorArg::Zed));
        } else {
            panic!("Expected Add command");
        }
    }

    #[test]
    fn test_parse_add_with_open_vscode_alias() {
        let cli = Cli::parse_from(["gwm", "add", "test", "--open", "vscode"]);
        if let Some(Commands::Add(args)) = cli.command {
            assert_eq!(args.open, Some(EditorArg::Code));
        } else {
            panic!("Expected Add command");
        }
    }

    #[test]
    fn test_parse_add_with_open_cursor() {
        let cli = Cli::parse_from(["gwm", "add", "test", "--open", "cursor"]);
        if let Some(Commands::Add(args)) = cli.command {
            assert_eq!(args.open, Some(EditorArg::Cursor));
        } else {
            panic!("Expected Add command");
        }
    }

    #[test]
    fn test_parse_go_with_open_option() {
        let cli = Cli::parse_from(["gwm", "go", "main", "--open", "cursor"]);
        if let Some(Commands::Go(args)) = cli.command {
            assert_eq!(args.open, Some(EditorArg::Cursor));
            assert!(!args.should_output_path_only());
        } else {
            panic!("Expected Go command");
        }
    }

    #[test]
    fn test_parse_go_with_open_short_form() {
        let cli = Cli::parse_from(["gwm", "go", "main", "-o", "code"]);
        if let Some(Commands::Go(args)) = cli.command {
            assert_eq!(args.open, Some(EditorArg::Code));
        } else {
            panic!("Expected Go command");
        }
    }

    #[test]
    fn test_legacy_code_flag_still_works() {
        // 後方互換性: --code は hide=true でも動作する
        let cli = Cli::parse_from(["gwm", "add", "test", "--code"]);
        if let Some(Commands::Add(args)) = cli.command {
            assert!(args.open_code);
            assert!(!args.should_output_path_only());
        } else {
            panic!("Expected Add command");
        }
    }

    #[test]
    fn test_legacy_cursor_flag_still_works() {
        // 後方互換性: --cursor は hide=true でも動作する
        let cli = Cli::parse_from(["gwm", "go", "main", "--cursor"]);
        if let Some(Commands::Go(args)) = cli.command {
            assert!(args.open_cursor);
            assert!(!args.should_output_path_only());
        } else {
            panic!("Expected Go command");
        }
    }

    #[test]
    fn test_legacy_short_c_flag_still_works() {
        // 後方互換性: -c は hide=true でも動作する（goコマンド専用）
        let cli = Cli::parse_from(["gwm", "go", "main", "-c"]);
        if let Some(Commands::Go(args)) = cli.command {
            assert!(args.open_code);
        } else {
            panic!("Expected Go command");
        }
    }

    #[test]
    fn test_parse_completion_bash() {
        let cli = Cli::parse_from(["gwm", "completion", "bash"]);
        match cli.command {
            Some(Commands::Completion(args)) => {
                assert_eq!(args.shell, CompletionShell::Bash);
                assert!(!args.with_dynamic);
            }
            _ => panic!("Expected Completion command"),
        }
    }

    #[test]
    fn test_parse_completion_with_dynamic() {
        let cli = Cli::parse_from(["gwm", "completion", "zsh", "--with-dynamic"]);
        match cli.command {
            Some(Commands::Completion(args)) => {
                assert_eq!(args.shell, CompletionShell::Zsh);
                assert!(args.with_dynamic);
            }
            _ => panic!("Expected Completion command"),
        }
    }

    #[test]
    fn test_list_format_names() {
        let cli = Cli::parse_from(["gwm", "list", "--format", "names"]);
        if let Some(Commands::List(args)) = cli.command {
            assert_eq!(args.format, OutputFormat::Names);
        } else {
            panic!("Expected List command");
        }
    }
}
