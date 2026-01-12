//! Worktree削除関連の操作
//!
//! worktreeの削除、ローカルブランチの削除、マージ状態の確認を提供します。

use std::path::Path;

use crate::error::Result;
use crate::shell::{exec, exec_silent};

// Note: local_branch_exists is exported from git/core.rs

/// Worktreeを削除
///
/// # Arguments
/// * `path` - 削除するworktreeのパス
/// * `force` - 強制削除フラグ（未コミット変更があっても削除）
///
/// # Returns
/// * 成功時: Ok(())
/// * 失敗時: GwmError
pub fn remove_worktree(path: &Path, force: bool) -> Result<()> {
    let path_str = path.display().to_string();

    let mut args = vec!["worktree", "remove"];
    if force {
        args.push("--force");
    }
    args.push(&path_str);

    exec("git", &args, None)?;
    Ok(())
}

/// ローカルブランチを削除
///
/// - `force=false`: `-d` (マージ済みのみ削除)
/// - `force=true`: `-D` (強制削除)
pub fn delete_local_branch(branch: &str, force: bool) -> Result<()> {
    let flag = if force { "-D" } else { "-d" };
    exec("git", &["branch", flag, branch], None)?;
    Ok(())
}

/// ブランチがいずれかのメインブランチにマージ済みかを確認
///
/// `git merge-base --is-ancestor` でブランチがメインブランチの祖先かを判定します。
pub fn is_branch_merged(branch: &str, main_branches: &[String]) -> bool {
    main_branches.iter().any(|main_branch| {
        exec_silent(
            "git",
            &["merge-base", "--is-ancestor", branch, main_branch],
            None,
        )
        .is_ok()
    })
}

/// Worktree削除の結果
#[derive(Debug, Clone)]
pub struct RemoveResult {
    /// 削除されたworktreeのパス
    pub path: String,
    /// 削除されたブランチ名
    pub branch: String,
    /// ローカルブランチも削除されたかどうか
    pub branch_deleted: bool,
    /// エラーが発生した場合のメッセージ
    pub error: Option<String>,
}

impl RemoveResult {
    /// 成功した削除結果を作成
    pub fn success(path: String, branch: String, branch_deleted: bool) -> Self {
        Self {
            path,
            branch,
            branch_deleted,
            error: None,
        }
    }

    /// 失敗した削除結果を作成
    pub fn failure(path: String, branch: String, error: impl Into<String>) -> Self {
        Self {
            path,
            branch,
            branch_deleted: false,
            error: Some(error.into()),
        }
    }

    /// 削除が成功したかどうか
    pub fn is_success(&self) -> bool {
        self.error.is_none()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_remove_result_success() {
        let result = RemoveResult::success(
            "/path/to/worktree".to_string(),
            "feature/test".to_string(),
            true,
        );
        assert!(result.is_success());
        assert!(result.branch_deleted);
        assert!(result.error.is_none());
    }

    #[test]
    fn test_remove_result_failure() {
        let result = RemoveResult::failure(
            "/path/to/worktree".to_string(),
            "feature/test".to_string(),
            "worktree not found",
        );
        assert!(!result.is_success());
        assert!(!result.branch_deleted);
        assert_eq!(result.error, Some("worktree not found".to_string()));
    }

    // Note: remove_worktree, delete_local_branch, is_branch_merged の
    // 実際のテストは統合テストで行う（実際のGitリポジトリが必要なため）
}
