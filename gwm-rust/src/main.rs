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
            if let Err(e) = gwm::ui::views::run_remove(args) {
                eprintln!("\x1b[31mError: {}\x1b[0m", e);
                std::process::exit(1);
            }
        }
        Some(Commands::Go(args)) => {
            if let Err(e) = gwm::ui::views::run_go(args) {
                eprintln!("\x1b[31mError: {}\x1b[0m", e);
                std::process::exit(1);
            }
        }
        Some(Commands::Clean(args)) => {
            if let Err(e) = gwm::ui::views::run_clean(args) {
                eprintln!("\x1b[31mError: {}\x1b[0m", e);
                std::process::exit(1);
            }
        }
        Some(Commands::PullMain) => {
            if let Err(e) = gwm::ui::views::run_pull_main() {
                eprintln!("\x1b[31mError: {}\x1b[0m", e);
                std::process::exit(1);
            }
        }
        Some(Commands::Help(args)) => {
            if let Err(e) = gwm::ui::views::run_help(args) {
                eprintln!("\x1b[31mError: {}\x1b[0m", e);
                std::process::exit(1);
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
