//! Git pull操作
//!
//! 指定されたディレクトリで`git pull`を実行する機能を提供します。

use std::path::Path;

use crate::error::Result;
use crate::shell::exec;

/// 指定されたディレクトリで`git pull`を実行
///
/// # Arguments
/// * `path` - git pullを実行するディレクトリ（worktreeのパス）
///
/// # Returns
/// * 成功時: git pullの出力
/// * 失敗時: GwmError
///
/// # Example
/// ```ignore
/// let output = pull_in_directory(Path::new("/path/to/worktree"))?;
/// if output.contains("Already up to date") {
///     println!("Already up to date");
/// } else {
///     println!("Updated: {}", output);
/// }
/// ```
pub fn pull_in_directory(path: &Path) -> Result<String> {
    exec("git", &["pull"], Some(path))
}

/// pull結果が「最新」かどうかを判定
///
/// # Arguments
/// * `output` - `git pull`の出力
///
/// # Returns
/// * 最新の場合: true
/// * 更新があった場合: false
pub fn is_already_up_to_date(output: &str) -> bool {
    output.contains("Already up to date") || output.contains("Already up-to-date")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_is_already_up_to_date_true() {
        assert!(is_already_up_to_date("Already up to date."));
        assert!(is_already_up_to_date("Already up-to-date."));
    }

    #[test]
    fn test_is_already_up_to_date_false() {
        assert!(!is_already_up_to_date("Updating abc123..def456"));
        assert!(!is_already_up_to_date("Fast-forward"));
    }
}
