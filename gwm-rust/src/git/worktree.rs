//! Worktree操作ユーティリティ
//!
//! Git worktreeの一覧取得・パース処理を提供します。

use std::path::PathBuf;

use super::core::is_git_repository;
use super::types::{Worktree, WorktreeStatus};
use crate::error::{GwmError, Result};
use crate::shell::exec;

/// `git worktree list --porcelain` の出力をパース
///
/// # Porcelain形式の例
/// ```text
/// worktree /path/to/main
/// HEAD abc1234567890
/// branch refs/heads/main
///
/// worktree /path/to/feature
/// HEAD def5678901234
/// branch refs/heads/feature/new-ui
///
/// worktree /path/to/detached
/// HEAD 1234567890abc
/// detached
/// ```
///
/// # パースルール
/// 1. `worktree <path>` - 新しいworktreeエントリの開始
/// 2. `HEAD <hash>` - コミットハッシュ
/// 3. `branch <ref>` - ブランチ参照
/// 4. `bare` - ベアリポジトリ
/// 5. `detached` - デタッチドHEAD状態
/// 6. 空行 - エントリの区切り
pub fn parse_worktrees(output: &str) -> Vec<Worktree> {
    let mut worktrees = Vec::new();
    let mut current: Option<WorktreeBuilder> = None;

    for line in output.lines() {
        if let Some(path) = line.strip_prefix("worktree ") {
            // 前のエントリを確定
            if let Some(builder) = current.take() {
                worktrees.push(builder.build());
            }

            // 新しいエントリを開始
            current = Some(WorktreeBuilder::new(PathBuf::from(path)));
        } else if let Some(ref mut builder) = current {
            if let Some(head) = line.strip_prefix("HEAD ") {
                builder.head = Some(head.to_string());
            } else if let Some(branch) = line.strip_prefix("branch ") {
                builder.branch = Some(branch.to_string());
            } else if line == "bare" {
                builder.branch = Some("(bare)".to_string());
                builder.is_main = true;
            } else if line == "detached" {
                builder.branch = Some("(detached)".to_string());
            }
            // "locked" は無視（ステータスに影響しない）
        }
    }

    // 最後のエントリを確定
    if let Some(builder) = current {
        worktrees.push(builder.build());
    }

    // ステータスを設定
    set_worktree_statuses(&mut worktrees);

    worktrees
}

/// Worktree構築用の一時構造体
struct WorktreeBuilder {
    path: PathBuf,
    head: Option<String>,
    branch: Option<String>,
    is_main: bool,
}

impl WorktreeBuilder {
    fn new(path: PathBuf) -> Self {
        Self {
            path,
            head: None,
            branch: None,
            is_main: false,
        }
    }

    fn build(self) -> Worktree {
        Worktree {
            path: self.path,
            branch: self.branch.unwrap_or_else(|| "(detached)".to_string()),
            head: self.head.unwrap_or_else(|| "UNKNOWN".to_string()),
            status: if self.is_main {
                WorktreeStatus::Main
            } else {
                WorktreeStatus::Other
            },
        }
    }
}

/// Worktreeのステータスを設定
///
/// 1. 最初のworktreeをMAINに設定（まだMAINがない場合）
/// 2. 現在のディレクトリと一致するworktreeをACTIVEに設定
fn set_worktree_statuses(worktrees: &mut [Worktree]) {
    // MAINを設定（最初のworktreeがデフォルト）
    if !worktrees.iter().any(|w| w.status == WorktreeStatus::Main) {
        if let Some(first) = worktrees.first_mut() {
            first.status = WorktreeStatus::Main;
        }
    }

    // ACTIVEを設定（現在のディレクトリと一致）
    let Some(current_dir) = std::env::current_dir().ok() else {
        return;
    };

    // 現在のパスを一度だけ canonicalize（パフォーマンス最適化）
    let current_canonical = current_dir.canonicalize().ok();

    for worktree in worktrees.iter_mut() {
        let is_match = match &current_canonical {
            Some(canonical_current) => {
                // 現在のパスが canonicalize 成功した場合のみ worktree を canonicalize
                worktree
                    .path
                    .canonicalize()
                    .ok()
                    .is_some_and(|canonical_wt| canonical_wt == *canonical_current)
            }
            None => {
                // canonicalize 失敗時は直接比較
                worktree.path == current_dir
            }
        };

        if is_match {
            worktree.status = WorktreeStatus::Active;
            break;
        }
    }
}

/// Worktree一覧をステータス付きで取得
///
/// # Errors
/// - Gitリポジトリでない場合: `GwmError::NotGitRepository`
/// - Gitコマンド失敗時: `GwmError::GitCommand`
pub fn get_worktrees() -> Result<Vec<Worktree>> {
    if !is_git_repository() {
        return Err(GwmError::NotGitRepository);
    }

    let output = exec("git", &["worktree", "list", "--porcelain"], None)?;
    Ok(parse_worktrees(&output))
}

/// メインworktreeのパスを取得
///
/// # Returns
/// * `Some(PathBuf)`: メインworktreeのパス
/// * `None`: worktreeが見つからない場合
pub fn get_main_worktree_path() -> Option<PathBuf> {
    get_worktrees()
        .ok()?
        .into_iter()
        .find(|w| w.status == WorktreeStatus::Main)
        .map(|w| w.path)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_worktrees_single() {
        let output = "worktree /path/to/main\nHEAD abc1234567890\nbranch refs/heads/main\n";
        let worktrees = parse_worktrees(output);
        assert_eq!(worktrees.len(), 1);
        assert_eq!(worktrees[0].path, PathBuf::from("/path/to/main"));
        assert_eq!(worktrees[0].branch, "refs/heads/main");
        assert_eq!(worktrees[0].head, "abc1234567890");
    }

    #[test]
    fn test_parse_worktrees_multiple() {
        let output = r#"worktree /path/to/main
HEAD abc1234
branch refs/heads/main

worktree /path/to/feature
HEAD def5678
branch refs/heads/feature/test
"#;
        let worktrees = parse_worktrees(output);
        assert_eq!(worktrees.len(), 2);
        assert_eq!(worktrees[0].path, PathBuf::from("/path/to/main"));
        assert_eq!(worktrees[1].path, PathBuf::from("/path/to/feature"));
    }

    #[test]
    fn test_parse_worktrees_detached() {
        let output = "worktree /path/to/detached\nHEAD 1234567\ndetached\n";
        let worktrees = parse_worktrees(output);
        assert_eq!(worktrees.len(), 1);
        assert_eq!(worktrees[0].branch, "(detached)");
    }

    #[test]
    fn test_parse_worktrees_bare() {
        let output = "worktree /path/to/bare\nHEAD 1234567\nbare\n";
        let worktrees = parse_worktrees(output);
        assert_eq!(worktrees.len(), 1);
        assert_eq!(worktrees[0].branch, "(bare)");
        assert_eq!(worktrees[0].status, WorktreeStatus::Main);
    }

    #[test]
    fn test_parse_worktrees_with_locked() {
        // lockedは無視される
        let output = "worktree /path/to/main\nHEAD abc1234\nbranch refs/heads/main\nlocked\n";
        let worktrees = parse_worktrees(output);
        assert_eq!(worktrees.len(), 1);
        assert_eq!(worktrees[0].branch, "refs/heads/main");
    }

    #[test]
    fn test_first_worktree_is_main() {
        let output = r#"worktree /path/to/first
HEAD abc1234
branch refs/heads/main

worktree /path/to/second
HEAD def5678
branch refs/heads/feature
"#;
        let worktrees = parse_worktrees(output);
        assert_eq!(worktrees[0].status, WorktreeStatus::Main);
        assert_eq!(worktrees[1].status, WorktreeStatus::Other);
    }

    #[test]
    fn test_parse_worktrees_missing_head() {
        let output = "worktree /path/to/main\nbranch refs/heads/main\n";
        let worktrees = parse_worktrees(output);
        assert_eq!(worktrees.len(), 1);
        assert_eq!(worktrees[0].head, "UNKNOWN");
    }

    #[test]
    fn test_parse_worktrees_missing_branch() {
        let output = "worktree /path/to/main\nHEAD abc1234\n";
        let worktrees = parse_worktrees(output);
        assert_eq!(worktrees.len(), 1);
        assert_eq!(worktrees[0].branch, "(detached)");
    }

    #[test]
    fn test_display_branch() {
        let worktree = Worktree {
            path: PathBuf::from("/test"),
            branch: "refs/heads/feature/test".to_string(),
            head: "abc1234".to_string(),
            status: WorktreeStatus::Other,
        };
        assert_eq!(worktree.display_branch(), "feature/test");
    }

    #[test]
    fn test_short_head() {
        let worktree = Worktree {
            path: PathBuf::from("/test"),
            branch: "main".to_string(),
            head: "abc1234567890".to_string(),
            status: WorktreeStatus::Main,
        };
        assert_eq!(worktree.short_head(), "abc1234");
    }
}
