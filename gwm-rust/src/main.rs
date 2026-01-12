//! gwm - Git Worktree Manager

use std::fmt::Display;

use clap::Parser;

use gwm::cli::{Cli, Commands};

fn handle_error<E: Display>(result: Result<(), E>) {
    if let Err(e) = result {
        eprintln!("\x1b[31mError: {}\x1b[0m", e);
        std::process::exit(1);
    }
}

fn show_welcome() {
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

#[tokio::main]
async fn main() {
    let cli = Cli::parse();

    match cli.command {
        Some(Commands::List) => handle_error(gwm::ui::views::run_list()),
        Some(Commands::Add(args)) => handle_error(gwm::ui::views::run_add(args).await),
        Some(Commands::Remove(args)) => handle_error(gwm::ui::views::run_remove(args)),
        Some(Commands::Go(args)) => handle_error(gwm::ui::views::run_go(args)),
        Some(Commands::Clean(args)) => handle_error(gwm::ui::views::run_clean(args)),
        Some(Commands::PullMain) => handle_error(gwm::ui::views::run_pull_main()),
        Some(Commands::Help(args)) => handle_error(gwm::ui::views::run_help(args)),
        None => show_welcome(),
    }
}
