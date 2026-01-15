//! シェルコマンド実行モジュール
//!
//! 外部プログラム（主にGit）を実行するためのユーティリティを提供します。
//! 同期版 (`exec`, `exec_silent`) と非同期版 (`exec_async`) を提供します。

pub mod completion;
pub mod cwd_file;
mod exec;
pub mod init;

pub use completion::run_completion;
pub use exec::{escape_shell_arg, exec, exec_async, exec_silent};

/// Get escaped gwm binary path expression for shell scripts.
///
/// Returns the current executable path escaped for shell usage,
/// or `'gwm'` as fallback if the path cannot be determined.
pub fn get_gwm_bin_expr() -> String {
    std::env::current_exe()
        .ok()
        .and_then(|p| p.to_str().map(escape_shell_arg))
        .unwrap_or_else(|| "'gwm'".to_string())
}
