//! gwm - Git Worktree Manager
//!
//! A CLI tool for managing Git worktrees with an interactive TUI.
//!
//! # Features
//!
//! - List all worktrees with status indicators
//! - Add new worktrees from local or remote branches
//! - Remove worktrees with optional branch cleanup
//! - Navigate between worktrees with shell integration
//! - Clean up merged/deleted worktrees
//! - Update main branch worktrees
//!
//! # Configuration
//!
//! gwm supports configuration at two levels:
//! - Global: `~/.config/gwm/config.toml` or `~/.gwmrc`
//! - Project: `<repo-root>/gwm/config.toml`
//!
//! Project configuration overrides global configuration.

pub mod cli;
pub mod config;
pub mod error;
pub mod git;
pub mod hooks;
pub mod shell;
pub mod trust;
pub mod ui;
pub mod utils;

pub use error::{GwmError, Result};
