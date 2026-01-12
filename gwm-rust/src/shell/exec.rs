//! シェルコマンド実行ユーティリティ
//!
//! 外部コマンド（主にGit）を実行するための関数群を提供します。
//! 同期版と非同期版の両方を提供し、用途に応じて使い分けます。

use std::path::Path;
use std::process::{Command, Stdio};

use tokio::process::Command as TokioCommand;

use crate::error::{GwmError, Result};

/// コマンド実行失敗時のエラーメッセージをフォーマット
fn format_execution_error(program: &str, error: std::io::Error) -> String {
    format!("failed to execute '{}': {}", program, error)
}

/// コマンド失敗時のエラーメッセージ（サイレント実行用）
const COMMAND_FAILED_MESSAGE: &str = "command failed";

/// シェルコマンドを同期実行し、出力を取得
///
/// # Arguments
/// * `program` - 実行するプログラム名（例: "git"）
/// * `args` - 引数のスライス
/// * `cwd` - 作業ディレクトリ（Noneの場合は現在のディレクトリ）
///
/// # Returns
/// * 成功時: stdout の文字列
/// * 失敗時: GwmError::GitCommand
///
/// # Example
/// ```ignore
/// let output = exec("git", &["worktree", "list", "--porcelain"], None)?;
/// ```
pub fn exec(program: &str, args: &[&str], cwd: Option<&Path>) -> Result<String> {
    let mut cmd = Command::new(program);
    cmd.args(args);

    if let Some(dir) = cwd {
        cmd.current_dir(dir);
    }

    let output = cmd
        .output()
        .map_err(|e| GwmError::GitCommand(format_execution_error(program, e)))?;

    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).to_string())
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr);
        Err(GwmError::git_command(stderr.trim()))
    }
}

/// シェルコマンドを同期実行し、成功/失敗のみを返す（出力不要の場合）
///
/// 標準出力・標準エラー出力は破棄されます。
///
/// # Arguments
/// * `program` - 実行するプログラム名
/// * `args` - 引数のスライス
/// * `cwd` - 作業ディレクトリ（Noneの場合は現在のディレクトリ）
///
/// # Returns
/// * 成功時: Ok(())
/// * 失敗時: GwmError::GitCommand
pub fn exec_silent(program: &str, args: &[&str], cwd: Option<&Path>) -> Result<()> {
    let mut cmd = Command::new(program);
    cmd.args(args).stdout(Stdio::null()).stderr(Stdio::null());

    if let Some(dir) = cwd {
        cmd.current_dir(dir);
    }

    let status = cmd
        .status()
        .map_err(|e| GwmError::GitCommand(format_execution_error(program, e)))?;

    if status.success() {
        Ok(())
    } else {
        Err(GwmError::git_command(COMMAND_FAILED_MESSAGE))
    }
}

/// シェルコマンドを非同期実行し、出力を取得
///
/// `git fetch` などの時間がかかる操作に使用します。
/// TUIのメインループをブロックせずにバックグラウンドで実行できます。
///
/// # Arguments
/// * `program` - 実行するプログラム名（例: "git"）
/// * `args` - 引数のスライス
/// * `cwd` - 作業ディレクトリ（Noneの場合は現在のディレクトリ）
///
/// # Returns
/// * 成功時: stdout の文字列
/// * 失敗時: GwmError::GitCommand
///
/// # Example
/// ```ignore
/// let output = exec_async("git", &["fetch", "--prune", "origin"], None).await?;
/// ```
pub async fn exec_async(program: &str, args: &[&str], cwd: Option<&Path>) -> Result<String> {
    let mut cmd = TokioCommand::new(program);
    cmd.args(args);

    if let Some(dir) = cwd {
        cmd.current_dir(dir);
    }

    let output = cmd
        .output()
        .await
        .map_err(|e| GwmError::GitCommand(format_execution_error(program, e)))?;

    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).to_string())
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr);
        Err(GwmError::git_command(stderr.trim()))
    }
}

/// シェル引数を安全にエスケープ
///
/// シングルクォートで囲み、内部のシングルクォートをエスケープします。
/// フック機能でシェルコマンドを実行する際に使用予定。
///
/// # Example
/// ```ignore
/// assert_eq!(escape_shell_arg("test"), "'test'");
/// assert_eq!(escape_shell_arg("it's"), "'it'\\''s'");
/// ```
#[allow(dead_code)]
pub fn escape_shell_arg(arg: &str) -> String {
    format!("'{}'", arg.replace('\'', "'\\''"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_exec_echo() {
        let result = exec("echo", &["hello"], None).unwrap();
        assert_eq!(result.trim(), "hello");
    }

    #[test]
    fn test_exec_with_args() {
        let result = exec("echo", &["hello", "world"], None).unwrap();
        assert_eq!(result.trim(), "hello world");
    }

    #[test]
    fn test_exec_silent_success() {
        assert!(exec_silent("true", &[], None).is_ok());
    }

    #[test]
    fn test_exec_silent_failure() {
        assert!(exec_silent("false", &[], None).is_err());
    }

    #[test]
    fn test_exec_nonexistent_command() {
        let result = exec("nonexistent_command_12345", &[], None);
        assert!(result.is_err());
    }

    #[test]
    fn test_escape_shell_arg_simple() {
        assert_eq!(escape_shell_arg("test"), "'test'");
    }

    #[test]
    fn test_escape_shell_arg_with_single_quote() {
        assert_eq!(escape_shell_arg("it's"), "'it'\\''s'");
    }

    #[test]
    fn test_escape_shell_arg_with_spaces() {
        assert_eq!(escape_shell_arg("hello world"), "'hello world'");
    }

    #[test]
    fn test_escape_shell_arg_empty() {
        assert_eq!(escape_shell_arg(""), "''");
    }
}
