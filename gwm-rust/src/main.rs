//! gwm - Git Worktree Manager
//!
//! Main entry point for the CLI application.

use clap::Parser;

use gwm::cli::{Cli, Commands};
use gwm::config::load_config;

#[tokio::main]
async fn main() {
    let cli = Cli::parse();

    // Load configuration
    let _config = load_config();

    match cli.command {
        Some(Commands::List) => {
            if let Err(e) = gwm::ui::views::run_list() {
                eprintln!("\x1b[31mError: {}\x1b[0m", e);
                std::process::exit(1);
            }
        }
        Some(Commands::Add(args)) => {
            if let Err(e) = gwm::ui::views::run_add(args).await {
                eprintln!("\x1b[31mError: {}\x1b[0m", e);
                std::process::exit(1);
            }
        }
        Some(Commands::Remove(args)) => {
            println!("gwm remove - Remove worktree (not yet implemented)");
            println!();
            if let Some(ref query) = args.query {
                println!("Query: {}", query);
            }
            if args.force {
                println!("Force: enabled");
            }
        }
        Some(Commands::Go(args)) => {
            println!("gwm go - Navigate to worktree (not yet implemented)");
            println!();
            if let Some(ref query) = args.query {
                println!("Query: {}", query);
            }
        }
        Some(Commands::Clean(args)) => {
            println!("gwm clean - Clean worktrees (not yet implemented)");
            println!();
            if args.dry_run {
                println!("Mode: Dry run");
            }
        }
        Some(Commands::PullMain) => {
            println!("gwm pull-main - Update main branches (not yet implemented)");
        }
        Some(Commands::Help(args)) => {
            match args.command.as_deref() {
                Some("list") | Some("ls") => {
                    println!("gwm list (alias: ls)");
                    println!();
                    println!("Display a table of all worktrees with their status.");
                    println!();
                    println!("Status indicators:");
                    println!("  [*] ACTIVE - Current worktree (yellow)");
                    println!("  [M] MAIN   - Main branch worktree (cyan)");
                    println!("  [-] OTHER  - Other worktrees (white)");
                }
                Some("add") => {
                    println!("gwm add [OPTIONS] [BRANCH_NAME]");
                    println!();
                    println!("Create a new worktree.");
                    println!();
                    println!("Options:");
                    println!("  -r, --remote       Select from remote branches");
                    println!("      --from <BRANCH> Base branch for new worktree");
                    println!("      --code         Open in VS Code after creation");
                    println!("      --cursor       Open in Cursor after creation");
                    println!("      --cd           Output path only");
                    println!("      --skip-hooks   Skip post_create hooks");
                }
                Some("remove") | Some("rm") => {
                    println!("gwm remove (alias: rm) [OPTIONS] [QUERY]");
                    println!();
                    println!("Remove one or more worktrees.");
                    println!();
                    println!("Options:");
                    println!("  -f, --force              Force removal");
                    println!("      --clean-branch MODE  Branch cleanup mode (auto|ask|never)");
                }
                Some("go") => {
                    println!("gwm go [OPTIONS] [QUERY]");
                    println!();
                    println!("Navigate to a worktree.");
                    println!();
                    println!("Options:");
                    println!("      --code    Open in VS Code");
                    println!("      --cursor  Open in Cursor");
                    println!();
                    println!("Shell integration:");
                    println!("  Add this to your ~/.zshrc or ~/.bashrc:");
                    println!();
                    println!("  function wgo() {{");
                    println!("    local path");
                    println!("    path=\"$(gwm go \"$1\")\"");
                    println!("    if [ -n \"$path\" ]; then");
                    println!("      cd \"$path\"");
                    println!("    fi");
                    println!("  }}");
                }
                Some("clean") => {
                    println!("gwm clean [OPTIONS]");
                    println!();
                    println!("Clean up merged or deleted worktrees.");
                    println!();
                    println!("Options:");
                    println!("  -n, --dry-run  Show what would be cleaned");
                    println!("  -y, --force    Skip confirmation prompt");
                }
                Some("pull-main") => {
                    println!("gwm pull-main");
                    println!();
                    println!("Update all main branch worktrees to latest.");
                    println!();
                    println!("Main branches are configured in config.toml:");
                    println!("  main_branches = [\"main\", \"master\", \"develop\"]");
                }
                Some(cmd) => {
                    eprintln!("Unknown command: {}", cmd);
                    eprintln!("Run 'gwm --help' for available commands.");
                    std::process::exit(1);
                }
                None => {
                    println!("gwm - Git Worktree Manager");
                    println!();
                    println!("Commands:");
                    println!("  list (ls)    List all worktrees");
                    println!("  add          Add a new worktree");
                    println!("  remove (rm)  Remove worktree(s)");
                    println!("  go           Navigate to a worktree");
                    println!("  clean        Clean up merged/deleted worktrees");
                    println!("  pull-main    Update main branch worktrees");
                    println!("  help         Show help for a command");
                    println!();
                    println!("Run 'gwm help <command>' for more information.");
                }
            }
        }
        None => {
            // No command provided - show welcome message
            println!("gwm - Git Worktree Manager");
            println!();
            println!("A CLI tool for managing Git worktrees with ease.");
            println!();
            println!("Quick start:");
            println!("  gwm list           List all worktrees");
            println!("  gwm add            Add a new worktree (interactive)");
            println!("  gwm add -r         Add from remote branch");
            println!("  gwm go             Navigate to a worktree");
            println!();
            println!("Run 'gwm --help' for all commands and options.");
        }
    }
}
