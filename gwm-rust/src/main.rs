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
    println!("gwm: A CLI tool to streamline your git worktree workflow.");
    println!();
    println!("\x1b[1mUSAGE:\x1b[0m");
    println!("  gwm <command> [arguments] [options]");
    println!();
    println!("\x1b[1mAVAILABLE COMMANDS:\x1b[0m");
    println!("  add           Create a new worktree");
    println!("  go            Go to a worktree directory or open it in an editor");
    println!("  init          Print shell integration script");
    println!("  list (ls)     List all worktrees for the current project");
    println!("  pull-main     Update the main branch worktree");
    println!("  remove (rm)   Remove one or more worktrees");
    println!("  clean         Clean up safe-to-delete worktrees");
    println!("  help          Show help for gwm or a specific command");
    println!();
    println!("Use \"gwm help <command>\" for more information about a specific command.");
}

#[tokio::main]
async fn main() {
    let cli = Cli::parse();

    match cli.command {
        Some(Commands::List) => handle_error(gwm::ui::views::run_list()),
        Some(Commands::Add(args)) => handle_error(gwm::ui::views::run_add(args).await),
        Some(Commands::Remove(args)) => handle_error(gwm::ui::views::run_remove(args)),
        Some(Commands::Go(args)) => handle_error(gwm::ui::views::run_go(args)),
        Some(Commands::Init(args)) => handle_error(gwm::shell::init::run_init(args.shell)),
        Some(Commands::Clean(args)) => handle_error(gwm::ui::views::run_clean(args)),
        Some(Commands::PullMain) => handle_error(gwm::ui::views::run_pull_main()),
        Some(Commands::Help(args)) => handle_error(gwm::ui::views::run_help(args)),
        None => show_welcome(),
    }
}
