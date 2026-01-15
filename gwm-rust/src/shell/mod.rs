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
    match std::env::current_exe() {
        Ok(path) => match path.to_str() {
            Some(s) => escape_shell_arg(s),
            None => {
                eprintln!("Warning: gwm path contains non-UTF8 characters, falling back to 'gwm'");
                "'gwm'".to_string()
            }
        },
        Err(e) => {
            eprintln!(
                "Warning: Could not determine gwm binary path ({}), falling back to 'gwm'",
                e
            );
            "'gwm'".to_string()
        }
    }
}
