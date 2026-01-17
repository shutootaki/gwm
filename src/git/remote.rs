//! リモートブランチ操作ユーティリティ
//!
//! リモートブランチの取得、状態確認機能を提供します。

use crate::error::Result;
use crate::shell::{exec_async, exec_silent};

/// リモートブランチ情報
#[derive(Debug, Clone)]
pub struct RemoteBranchInfo {
    /// ブランチ名（origin/を除去済み）
    pub name: String,
    /// フル名（origin/feature/xxx）
    pub full_name: String,
    /// 最後のコミット日時（ISO8601形式）
    pub last_commit_date: String,
    /// 最後のコミッター名
    pub last_committer_name: String,
    /// 最後のコミットメッセージ
    pub last_commit_message: String,
}

/// リモートブランチの状態
#[derive(Debug, Clone)]
pub struct RemoteBranchStatus {
    /// リモートにブランチが存在しない
    pub is_deleted: bool,
    /// メインブランチにマージ済み
    pub is_merged: bool,
    /// マージ先のブランチ名
    pub merged_into_branch: Option<String>,
}

/// git fetch --prune を実行
///
/// リモートの変更を取得し、削除されたリモートブランチの参照を削除します。
pub async fn fetch_and_prune() -> Result<()> {
    exec_async("git", &["fetch", "--prune", "origin"], None).await?;
    Ok(())
}

/// リモートブランチの詳細情報を取得
///
/// `git for-each-ref` を使用してリモートブランチのメタデータを取得します。
///
/// # Returns
/// リモートブランチ情報のベクター（origin/HEADを除く）
pub async fn get_remote_branches_with_info() -> Result<Vec<RemoteBranchInfo>> {
    let output = exec_async(
        "git",
        &[
            "for-each-ref",
            "refs/remotes",
            "--format=%(refname:short)|%(committerdate:iso8601-strict)|%(committername)|%(subject)",
        ],
        None,
    )
    .await?;

    let branches: Vec<RemoteBranchInfo> = output
        .lines()
        .filter(|line| !line.is_empty() && !line.contains("HEAD"))
        .filter_map(|line| {
            let parts: Vec<&str> = line.split('|').collect();
            if parts.len() >= 4 {
                let full_name = parts[0].to_string();
                // "origin" のようなリモート名のみのエントリを除外
                // "origin/branch" のような形式のみ許可
                let name = full_name.strip_prefix("origin/")?;

                Some(RemoteBranchInfo {
                    name: name.to_string(),
                    full_name,
                    last_commit_date: parts[1].to_string(),
                    last_committer_name: parts[2].to_string(),
                    last_commit_message: parts[3].to_string(),
                })
            } else {
                None
            }
        })
        .collect();

    Ok(branches)
}

/// リモートブランチの状態を確認（同期版）
///
/// `gwm clean` コマンドでマージ済みブランチの検出に使用します。
///
/// # Arguments
/// * `branch` - ブランチ名（refs/heads/プレフィックスあり/なし両対応）
/// * `main_branches` - メインブランチのリスト（例: ["main", "master", "develop"]）
///
/// # Returns
/// リモートブランチの状態（削除済み、マージ済みなど）
pub fn check_remote_branch_status(branch: &str, main_branches: &[String]) -> RemoteBranchStatus {
    let branch_name = branch.strip_prefix("refs/heads/").unwrap_or(branch);

    // リモートブランチの存在確認
    let ref_path = format!("refs/remotes/origin/{}", branch_name);
    let is_deleted =
        exec_silent("git", &["show-ref", "--verify", "--quiet", &ref_path], None).is_err();

    let mut is_merged = false;
    let mut merged_into_branch = None;

    // マージ判定（リモートにブランチがある場合のみ）
    if !is_deleted {
        for main_br in main_branches {
            let result = exec_silent(
                "git",
                &[
                    "merge-base",
                    "--is-ancestor",
                    &format!("origin/{}", branch_name),
                    &format!("origin/{}", main_br),
                ],
                None,
            );

            if result.is_ok() {
                is_merged = true;
                merged_into_branch = Some(main_br.clone());
                break;
            }
        }
    }

    RemoteBranchStatus {
        is_deleted,
        is_merged,
        merged_into_branch,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_remote_branch_status_default() {
        // デフォルト状態のテスト
        let status = RemoteBranchStatus {
            is_deleted: false,
            is_merged: false,
            merged_into_branch: None,
        };
        assert!(!status.is_deleted);
        assert!(!status.is_merged);
        assert!(status.merged_into_branch.is_none());
    }

    #[test]
    fn test_remote_branch_info_construction() {
        let info = RemoteBranchInfo {
            name: "feature/test".to_string(),
            full_name: "origin/feature/test".to_string(),
            last_commit_date: "2024-01-15T10:30:00+00:00".to_string(),
            last_committer_name: "John Doe".to_string(),
            last_commit_message: "Add new feature".to_string(),
        };
        assert_eq!(info.name, "feature/test");
        assert_eq!(info.full_name, "origin/feature/test");
    }

    #[test]
    fn test_remote_branch_status_deleted() {
        // is_deleted=true の状態確認
        let status = RemoteBranchStatus {
            is_deleted: true,
            is_merged: false,
            merged_into_branch: None,
        };
        assert!(status.is_deleted);
        assert!(!status.is_merged);
        assert!(status.merged_into_branch.is_none());
    }

    #[test]
    fn test_remote_branch_status_merged() {
        // is_merged=true, merged_into_branch の確認
        let status = RemoteBranchStatus {
            is_deleted: false,
            is_merged: true,
            merged_into_branch: Some("main".to_string()),
        };
        assert!(!status.is_deleted);
        assert!(status.is_merged);
        assert_eq!(status.merged_into_branch, Some("main".to_string()));
    }

    #[test]
    fn test_remote_branch_status_deleted_and_merged() {
        // 削除済みかつマージ済みの状態（通常はis_deleted=trueの場合is_merged=falseになるが、構造体としては設定可能）
        let status = RemoteBranchStatus {
            is_deleted: true,
            is_merged: true,
            merged_into_branch: Some("develop".to_string()),
        };
        assert!(status.is_deleted);
        assert!(status.is_merged);
        assert_eq!(status.merged_into_branch, Some("develop".to_string()));
    }

    #[test]
    fn test_remote_branch_info_all_fields() {
        // 全フィールドの設定確認
        let info = RemoteBranchInfo {
            name: "feature/auth-system".to_string(),
            full_name: "origin/feature/auth-system".to_string(),
            last_commit_date: "2025-01-15T14:30:00+09:00".to_string(),
            last_committer_name: "Alice Developer".to_string(),
            last_commit_message: "Add authentication middleware".to_string(),
        };

        assert_eq!(info.name, "feature/auth-system");
        assert_eq!(info.full_name, "origin/feature/auth-system");
        assert_eq!(info.last_commit_date, "2025-01-15T14:30:00+09:00");
        assert_eq!(info.last_committer_name, "Alice Developer");
        assert_eq!(info.last_commit_message, "Add authentication middleware");
    }

    #[test]
    fn test_remote_branch_info_name_without_origin_prefix() {
        // origin/ プレフィックスがない場合の動作確認
        let info = RemoteBranchInfo {
            name: "main".to_string(),
            full_name: "main".to_string(), // origin/ なし
            last_commit_date: "2025-01-01T00:00:00Z".to_string(),
            last_committer_name: "Bot".to_string(),
            last_commit_message: "Initial commit".to_string(),
        };

        assert_eq!(info.name, "main");
        assert_eq!(info.full_name, "main");
    }
}
