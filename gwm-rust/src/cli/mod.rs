//! CLI module for gwm.
//!
//! This module provides the command-line interface using clap.

pub mod args;

pub use args::{
    AddArgs, CleanArgs, Cli, Commands, CompletionArgs, CompletionShell, GoArgs, HelpArgs, InitArgs,
    ListArgs, OutputFormat, RemoveArgs, ShellType,
};
