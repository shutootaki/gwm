//! Worktree追加処理
//!
//! 新しいworktreeを作成するための機能を提供します。

use std::path::PathBuf;

use crate::config::Config;
use crate::error::{GwmError, Result};
use crate::shell::exec;
use crate::utils::sanitize_branch_name;

use super::core::{get_repository_name, local_branch_exists};

/// Worktree追加オプション
#[derive(Debug, Clone)]
pub struct AddWorktreeOptions {
    /// ブランチ名
    pub branch: String,
    /// リモートブランチからチェックアウト
    pub is_remote: bool,
    /// ベースブランチ（新規作成時）
    pub from_branch: Option<String>,
}

/// Worktree追加結果
#[derive(Debug)]
pub struct AddWorktreeResult {
    /// 作成されたworktreeのパス
    pub path: PathBuf,
    /// 実行されたアクションのログ
    pub actions: Vec<String>,
}

/// Worktreeを追加
///
/// 以下の3つのケースを処理します：
/// 1. ローカルブランチが既存: `git worktree add <path> <branch>`
/// 2. リモートから作成: `git worktree add <path> -b <branch> origin/<branch>`
/// 3. 新規作成: `git worktree add <path> -b <branch> <from_branch>`
///
/// # Arguments
/// * `config` - 設定（worktree_base_path, main_branchesを使用）
/// * `options` - 追加オプション（ブランチ名、リモートフラグなど）
///
/// # Returns
/// * `Ok(AddWorktreeResult)`: 作成されたworktreeのパスとアクションログ
/// * `Err(GwmError)`: 作成失敗
pub fn add_worktree(config: &Config, options: &AddWorktreeOptions) -> Result<AddWorktreeResult> {
    let repo_name = get_repository_name();
    let sanitized_branch = sanitize_branch_name(&options.branch);

    // worktreeパスを生成
    let base_path = config
        .expanded_worktree_base_path()
        .ok_or_else(|| GwmError::Path("Failed to expand worktree base path".to_string()))?;

    let worktree_path = base_path.join(&repo_name).join(&sanitized_branch);

    // ローカルブランチの存在確認
    let local_exists = local_branch_exists(&options.branch);

    let mut actions = Vec::new();

    // gitコマンドを構築
    let args: Vec<String> = if local_exists {
        // 既存ローカルブランチを使用
        actions.push(format!("Using existing local branch: {}", options.branch));
        vec![
            "worktree".to_string(),
            "add".to_string(),
            worktree_path.display().to_string(),
            options.branch.clone(),
        ]
    } else if options.is_remote {
        // リモートブランチからチェックアウト
        actions.push(format!(
            "Creating worktree from remote branch: origin/{}",
            options.branch
        ));
        vec![
            "worktree".to_string(),
            "add".to_string(),
            worktree_path.display().to_string(),
            "-b".to_string(),
            options.branch.clone(),
            format!("origin/{}", options.branch),
        ]
    } else {
        // 新規ブランチを作成
        let base = options
            .from_branch
            .as_ref()
            .map(|s| s.as_str())
            .unwrap_or_else(|| {
                config
                    .main_branches
                    .first()
                    .map(|s| s.as_str())
                    .unwrap_or("main")
            });

        actions.push(format!(
            "Creating new branch '{}' from '{}'",
            options.branch, base
        ));
        vec![
            "worktree".to_string(),
            "add".to_string(),
            worktree_path.display().to_string(),
            "-b".to_string(),
            options.branch.clone(),
            base.to_string(),
        ]
    };

    // 実行
    let args_ref: Vec<&str> = args.iter().map(|s| s.as_str()).collect();
    exec("git", &args_ref, None)?;

    actions.push(format!("Worktree created at: {}", worktree_path.display()));

    Ok(AddWorktreeResult {
        path: worktree_path,
        actions,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_add_worktree_options_construction() {
        let options = AddWorktreeOptions {
            branch: "feature/test".to_string(),
            is_remote: false,
            from_branch: Some("develop".to_string()),
        };
        assert_eq!(options.branch, "feature/test");
        assert!(!options.is_remote);
        assert_eq!(options.from_branch, Some("develop".to_string()));
    }

    #[test]
    fn test_add_worktree_options_remote() {
        let options = AddWorktreeOptions {
            branch: "feature/remote-branch".to_string(),
            is_remote: true,
            from_branch: None,
        };
        assert!(options.is_remote);
        assert!(options.from_branch.is_none());
    }
}
