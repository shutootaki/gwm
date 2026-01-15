//! シェルコマンド実行モジュール
//!
//! 外部プログラム（主にGit）を実行するためのユーティリティを提供します。
//! 同期版 (`exec`, `exec_silent`) と非同期版 (`exec_async`) を提供します。

pub mod cwd_file;
mod exec;
pub mod init;

pub use exec::{escape_shell_arg, exec, exec_async, exec_silent};
