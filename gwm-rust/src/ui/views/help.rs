//! helpコマンドの実装
//!
//! 各コマンドの詳細なヘルプテキストを表示します。

use crate::cli::HelpArgs;
use crate::error::Result;

/// ヘルプテキスト定義モジュール
mod help_text {
    pub const GLOBAL: &str = r#"
gwm - Git Worktree Manager

A CLI tool for managing Git worktrees with an interactive TUI.

USAGE:
    gwm [COMMAND]

COMMANDS:
    list (ls)       List all worktrees
    add             Add a new worktree
    remove (rm)     Remove worktree(s)
    go              Navigate to a worktree
    init            Shell integration script
    clean           Clean up merged/deleted worktrees
    sync            Sync main branch worktrees
    completion      Generate shell completion scripts
    help            Show this help message

EXAMPLES:
    gwm                     Show welcome message
    gwm list                Show worktree list
    gwm add                 Create new worktree (interactive)
    gwm add -r              Create from remote branch
    gwm remove              Remove worktrees (multi-select)
    gwm go feature          Navigate to worktree matching "feature"
    eval "$(gwm init bash)" Install shell integration (bash/zsh)
    gwm clean -n            Show cleanable worktrees (dry-run)

For more information about a command, run:
    gwm help <COMMAND>
    gwm <COMMAND> --help

CONFIGURATION:
    Config file: ~/.config/gwm/config.toml

    Example config:
        worktree_base_path = "~/git-worktrees"
        main_branches = ["main", "master", "develop"]
        clean_branch = "ask"  # auto | ask | never

        [copy_ignored_files]
        enabled = true
        patterns = [".env", ".env.*"]

        [hooks.post_create]
        enabled = true
        commands = ["npm install"]
"#;

    pub const LIST: &str = r#"
gwm list - List all worktrees

USAGE:
    gwm list
    gwm ls

DESCRIPTION:
    Display a table of all Git worktrees with their status, branch, path,
    and HEAD commit hash.

STATUS INDICATORS:
    [*] ACTIVE  - Current working worktree (yellow)
    [M] MAIN    - Main branch worktree (cyan)
    [-] OTHER   - Other worktrees (white)

EXAMPLES:
    gwm list            Show all worktrees
    gwm ls              Same as above (alias)
"#;

    pub const ADD: &str = r#"
gwm add - Add a new worktree

USAGE:
    gwm add [OPTIONS] [BRANCH_NAME]

ARGUMENTS:
    [BRANCH_NAME]    Name for the new branch (optional)

OPTIONS:
    -r, --remote           Select from remote branches
        --from <BRANCH>    Base branch for new worktree (default: main)
        --code             Open in VS Code after creation
        --cursor           Open in Cursor after creation
        --no-cd            Show success message instead of path output
        --skip-hooks       Skip post_create hook execution

DESCRIPTION:
    Create a new worktree. Without arguments, opens an interactive text input
    for entering a new branch name. With -r flag, shows a list of remote
    branches to select from.

    The worktree is created at:
        {worktree_base_path}/{repo_name}/{branch_name}

    Branch names are sanitized: feature/auth → feature-auth

EXAMPLES:
    gwm add                     Interactive new branch input
    gwm add feature/auth        Create worktree for "feature/auth"
    gwm add -r                  Select from remote branches
    gwm add --from develop      Branch from "develop" instead of main
    gwm add feature --code      Create and open in VS Code
    gwm add feature --skip-hooks  Create without running hooks
"#;

    pub const REMOVE: &str = r#"
gwm remove - Remove worktree(s)

USAGE:
    gwm remove [OPTIONS] [QUERY]
    gwm rm [OPTIONS] [QUERY]

ARGUMENTS:
    [QUERY]    Filter worktrees by name (optional)

OPTIONS:
    -f, --force              Force removal without confirmation
        --clean-branch <MODE>    Local branch cleanup mode
                             Values: auto, ask, never (default: config value)

DESCRIPTION:
    Remove one or more worktrees using a multi-select interface.
    Main worktrees cannot be selected for removal.

    clean-branch modes:
        auto  - Automatically delete merged branches, force delete unmerged
        ask   - Prompt before deleting each branch
        never - Keep local branches (default)

EXAMPLES:
    gwm remove              Multi-select interface
    gwm rm feature          Filter by "feature"
    gwm remove -f           Force remove without confirmation
    gwm remove --clean-branch auto  Auto-delete local branches
"#;

    pub const GO: &str = r#"
gwm go - Navigate to a worktree

USAGE:
    gwm go [OPTIONS] [QUERY]

ARGUMENTS:
    [QUERY]    Filter worktrees by name (optional)

OPTIONS:
    -c, --code     Open in VS Code
        --cursor   Open in Cursor

DESCRIPTION:
    Navigate to a worktree by outputting its path. Designed to work with
    a shell function for directory navigation.

    Without options, prints the worktree path to stdout.
    With --code or --cursor, opens the worktree in the editor.

EXAMPLES:
    gwm go                  Interactive selection
    gwm go feature          Select matching "feature"
    gwm go main --code      Open main worktree in VS Code
"#;

    pub const INIT: &str = r#"
gwm init - Print shell integration script

USAGE:
    gwm init <SHELL>

ARGUMENTS:
    <SHELL>    Shell type (bash, zsh, fish)

DESCRIPTION:
    Output a shell script that:
    1. Defines a `gwm` wrapper function for `cd` integration
    2. Sets up shell completion with dynamic worktree name completion

    Add the output to your shell configuration file.

INSTALLATION:
    Bash (~/.bashrc):
        eval "$(gwm init bash)"

    Zsh (~/.zshrc):
        eval "$(gwm init zsh)"

    Fish (~/.config/fish/config.fish):
        gwm init fish | source

NOTE:
    The `gwm completion` command is still available if you need:
    - Static completion only (without dynamic worktree names)
    - Completion script saved to a file instead of eval

EXAMPLES:
    eval "$(gwm init zsh)"    Full setup (recommended)
    gwm init fish | source    Fish shell setup
"#;

    pub const CLEAN: &str = r#"
gwm clean - Clean up merged/deleted worktrees

USAGE:
    gwm clean [OPTIONS]

OPTIONS:
    -n, --dry-run    Show what would be deleted without deleting
        --force      Skip confirmation prompt

DESCRIPTION:
    Safely remove worktrees that are no longer needed. A worktree is
    considered cleanable if ALL of the following conditions are met:

    1. Remote branch has been deleted, OR
    2. Local branch is merged into a main branch

    AND:
    3. No uncommitted changes
    4. No unpushed commits

    Main and active worktrees are never cleaned.

EXAMPLES:
    gwm clean              Show confirmation before cleaning
    gwm clean -n           Dry run: show candidates only
    gwm clean --force      Clean without confirmation (for CI/CD)
"#;

    pub const SYNC: &str = r#"
gwm sync - Sync main branch worktrees

USAGE:
    gwm sync
    gwm pull-main  (legacy alias)

DESCRIPTION:
    Run 'git pull' in all worktrees that track main branches.
    Main branches are defined in the config file.

    Default main branches: main, master, develop

EXAMPLES:
    gwm sync               Sync all main branch worktrees
"#;

    pub const HELP: &str = r#"
gwm help - Show help information

USAGE:
    gwm help [COMMAND]

ARGUMENTS:
    [COMMAND]    The command to show help for (optional)

DESCRIPTION:
    Display detailed help for gwm or a specific command.
    Without arguments, shows the general help message.

EXAMPLES:
    gwm help         Show general help
    gwm help add     Show help for 'add' command
    gwm help remove  Show help for 'remove' command
"#;

    pub const COMPLETION: &str = r#"
gwm completion - Generate shell completion scripts

USAGE:
    gwm completion <SHELL> [OPTIONS]

ARGUMENTS:
    <SHELL>    Shell type (bash, zsh, fish)

OPTIONS:
    --with-dynamic    Enable dynamic completion for worktree names

DESCRIPTION:
    Generate shell completion scripts for command and option completion.
    With --with-dynamic, the script will also provide real-time completion
    for worktree names when using commands like 'go' and 'remove'.

INSTALLATION:

    Bash:
        gwm completion bash --with-dynamic > ~/.local/share/bash-completion/completions/gwm
        # or add to ~/.bashrc:
        eval "$(gwm completion bash --with-dynamic)"

    Zsh:
        gwm completion zsh --with-dynamic > ~/.zfunc/_gwm
        # Add to ~/.zshrc:
        fpath=(~/.zfunc $fpath)
        autoload -Uz compinit && compinit

    Fish:
        gwm completion fish --with-dynamic > ~/.config/fish/completions/gwm.fish

EXAMPLES:
    gwm completion bash              Generate basic Bash completion
    gwm completion zsh --with-dynamic  Generate Zsh completion with worktree names
    gwm completion fish --with-dynamic Generate Fish completion with worktree names
"#;
}

/// helpコマンドを実行
pub fn run_help(args: HelpArgs) -> Result<()> {
    let text = match args.command.as_deref() {
        None => help_text::GLOBAL,
        Some("list") | Some("ls") => help_text::LIST,
        Some("add") => help_text::ADD,
        Some("remove") | Some("rm") => help_text::REMOVE,
        Some("go") => help_text::GO,
        Some("init") => help_text::INIT,
        Some("clean") => help_text::CLEAN,
        Some("sync") | Some("pull-main") => help_text::SYNC,
        Some("completion") => help_text::COMPLETION,
        Some("help") => help_text::HELP,
        Some(cmd) => {
            eprintln!("Unknown command: {}", cmd);
            eprintln!("Run 'gwm help' for available commands.");
            return Ok(());
        }
    };

    println!("{}", text.trim());
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    /// テーブル駆動テスト: 各コマンドに対してrun_helpが正常に実行されることを確認
    #[test]
    fn test_run_help_for_all_commands() {
        // (テスト名, コマンド引数)
        let test_cases: &[(&str, Option<&str>)] = &[
            ("global", None),
            ("list", Some("list")),
            ("list_alias_ls", Some("ls")),
            ("add", Some("add")),
            ("remove", Some("remove")),
            ("remove_alias_rm", Some("rm")),
            ("go", Some("go")),
            ("init", Some("init")),
            ("clean", Some("clean")),
            ("sync", Some("sync")),
            ("sync_alias_pull_main", Some("pull-main")),
            ("completion", Some("completion")),
            ("help", Some("help")),
            ("unknown", Some("unknown")),
        ];

        for (name, command) in test_cases {
            let args = HelpArgs {
                command: command.map(String::from),
            };
            let result = run_help(args);
            assert!(
                result.is_ok(),
                "run_help failed for command '{}': {:?}",
                name,
                result.err()
            );
        }
    }

    /// ヘルプテキスト定数が空でないことを確認
    #[test]
    fn test_help_text_constants_not_empty() {
        let texts: &[(&str, &str)] = &[
            ("GLOBAL", help_text::GLOBAL),
            ("LIST", help_text::LIST),
            ("ADD", help_text::ADD),
            ("REMOVE", help_text::REMOVE),
            ("GO", help_text::GO),
            ("INIT", help_text::INIT),
            ("CLEAN", help_text::CLEAN),
            ("SYNC", help_text::SYNC),
            ("COMPLETION", help_text::COMPLETION),
            ("HELP", help_text::HELP),
        ];

        for (name, text) in texts {
            assert!(
                !text.trim().is_empty(),
                "help_text::{} should not be empty",
                name
            );
        }
    }
}
