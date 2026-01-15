//! Worktree操作ユーティリティ
//!
//! Git worktreeの一覧取得・パース処理を提供します。

use std::path::{Path, PathBuf};

use rayon::prelude::*;

use super::core::is_git_repository;
use super::types::{ChangeStatus, ChangedFile, SyncStatus, Worktree, WorktreeStatus};
use crate::error::{GwmError, Result};
use crate::shell::exec;

use chrono::{DateTime, Utc};

/// `git worktree list --porcelain` の出力をパース（内部用）
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
fn parse_worktrees_raw(output: &str) -> Vec<Worktree> {
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

    worktrees
}

pub fn parse_worktrees(output: &str) -> Vec<Worktree> {
    use crate::config::load_config;
    let config = load_config();
    let mut worktrees = parse_worktrees_raw(output);
    set_worktree_statuses(&mut worktrees, &config.main_branches);
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
            is_main: self.is_main,
            sync_status: None,
            change_status: None,
            last_activity: None,
        }
    }
}

/// Worktreeのステータスを設定
///
/// 1. 最初のworktreeをMAINに設定（TypeScript版と同じ）
/// 2. main_branchesに含まれるブランチのworktreeもMAINに設定
/// 3. 現在のディレクトリがworktree配下にある場合ACTIVEに設定
fn set_worktree_statuses(worktrees: &mut [Worktree], main_branches: &[String]) {
    // 最初のworktreeをMAINに設定（bareでない場合）
    if let Some(first) = worktrees.first_mut() {
        first.is_main = true;
        if first.status != WorktreeStatus::Main {
            first.status = WorktreeStatus::Main;
        }
    }

    // main_branchesに含まれるブランチもMAINに設定
    for worktree in worktrees.iter_mut() {
        let branch = worktree.display_branch();
        if main_branches.iter().any(|main| main == branch) {
            worktree.is_main = true;
            worktree.status = WorktreeStatus::Main;
        }
    }

    // ACTIVEを設定（現在のディレクトリがworktree配下にある場合）
    let Some(current_dir) = std::env::current_dir().ok() else {
        return;
    };

    // 現在のパスを一度だけ canonicalize（パフォーマンス最適化）
    let current_canonical = current_dir.canonicalize().ok();

    for worktree in worktrees.iter_mut() {
        let is_match = match &current_canonical {
            Some(canonical_current) => {
                // worktree を canonicalize して完全一致で比較（TypeScript版と同じ）
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
            // ACTIVEに設定（is_mainは維持）
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

/// Worktree一覧を詳細情報付きで取得
///
/// 各worktreeの詳細情報（同期状態、変更状態、最終更新時間）を並列に取得することで
/// パフォーマンスを向上させています。
///
/// # Returns
/// * `Ok(Vec<Worktree>)`: 詳細情報付きのworktree一覧
/// * `Err(GwmError)`: エラー時
pub fn get_worktrees_with_details() -> Result<Vec<Worktree>> {
    let worktrees = get_worktrees()?;

    // 詳細情報を並列に取得
    let details: Vec<_> = worktrees
        .par_iter()
        .map(|wt| {
            let sync = get_sync_status(&wt.path, wt.display_branch());
            let change = get_change_status(&wt.path);
            let activity = get_last_activity(&wt.path);
            (sync, change, activity)
        })
        .collect();

    // 結果をworktreesにマージ
    let mut worktrees = worktrees;
    for (i, (sync, change, activity)) in details.into_iter().enumerate() {
        worktrees[i].sync_status = sync;
        worktrees[i].change_status = change;
        worktrees[i].last_activity = activity;
    }

    Ok(worktrees)
}

/// リモートとの同期状態を取得
///
/// リモートブランチが存在しない場合や detached HEAD 状態では `None` を返す。
fn get_sync_status(path: &Path, branch: &str) -> Option<SyncStatus> {
    // リモートブランチの存在確認と ahead/behind の取得
    let output = match exec(
        "git",
        &[
            "-C",
            &path.display().to_string(),
            "rev-list",
            "--left-right",
            "--count",
            &format!("HEAD...origin/{}", branch),
        ],
        None,
    ) {
        Ok(out) => out,
        Err(e) => {
            // リモートブランチが存在しない場合は正常なケース
            let err_str = e.to_string();
            if !err_str.contains("unknown revision") && !err_str.contains("ambiguous argument") {
                #[cfg(debug_assertions)]
                eprintln!(
                    "Debug: get_sync_status failed for {} at {:?}: {}",
                    branch, path, e
                );
            }
            return None;
        }
    };

    let parts: Vec<&str> = output.trim().split('\t').collect();
    if parts.len() == 2 {
        let ahead = parts[0].parse().unwrap_or(0);
        let behind = parts[1].parse().unwrap_or(0);
        Some(SyncStatus { ahead, behind })
    } else {
        #[cfg(debug_assertions)]
        eprintln!(
            "Debug: Unexpected rev-list output format for {} at {:?}: {:?}",
            branch, path, output
        );
        None
    }
}

/// ワーキングディレクトリの変更状態を取得
///
/// 変更状態（staged/unstaged/untracked）を集計して返す。
/// 変更ファイルリストは最大5件まで収集する。
/// gitコマンドが失敗した場合は `None` を返す。
fn get_change_status(path: &Path) -> Option<ChangeStatus> {
    let output = match exec(
        "git",
        &["-C", &path.display().to_string(), "status", "--porcelain"],
        None,
    ) {
        Ok(out) => out,
        Err(e) => {
            #[cfg(debug_assertions)]
            eprintln!("Debug: get_change_status failed at {:?}: {}", path, e);
            return None;
        }
    };

    let mut status = ChangeStatus::default();
    let mut files: Vec<ChangedFile> = Vec::new();

    for line in output.lines() {
        if line.len() < 3 {
            continue;
        }

        let index_status = line.chars().next().unwrap_or(' ');
        let worktree_status = line.chars().nth(1).unwrap_or(' ');
        let file_path = line[3..].to_string();

        // ステータスに基づいてカウントと表示用ステータスを決定
        let display_status = match (index_status, worktree_status) {
            ('?', '?') => {
                status.untracked += 1;
                '?'
            }
            ('M', _) | (_, 'M') => {
                status.modified += 1;
                'M'
            }
            ('A', _) => {
                status.added += 1;
                'A'
            }
            ('D', _) | (_, 'D') => {
                status.deleted += 1;
                'D'
            }
            _ => continue,
        };

        // 最大5件までファイルを収集
        if files.len() < 5 {
            files.push(ChangedFile {
                status: display_status,
                path: file_path,
            });
        }
    }

    status.changed_files = files;
    Some(status)
}

/// 最終更新時間を相対時間形式で取得
///
/// worktreeの最新コミット時刻を基準に、現在時刻との差分を
/// "just now", "5m ago", "2h ago" などの形式で返す。
/// コミット履歴がない場合や取得に失敗した場合は `None` を返す。
fn get_last_activity(path: &Path) -> Option<String> {
    let output = match exec(
        "git",
        &[
            "-C",
            &path.display().to_string(),
            "log",
            "-1",
            "--format=%cI", // ISO 8601 形式
        ],
        None,
    ) {
        Ok(out) => out,
        Err(e) => {
            #[cfg(debug_assertions)]
            eprintln!("Debug: get_last_activity failed at {:?}: {}", path, e);
            return None;
        }
    };

    let timestamp_str = output.trim();
    if timestamp_str.is_empty() {
        return None;
    }

    // ISO 8601 形式をパース
    let commit_time = match DateTime::parse_from_rfc3339(timestamp_str) {
        Ok(dt) => dt.with_timezone(&Utc),
        Err(e) => {
            #[cfg(debug_assertions)]
            eprintln!(
                "Debug: Failed to parse timestamp '{}' at {:?}: {}",
                timestamp_str, path, e
            );
            return None;
        }
    };
    let now = Utc::now();
    let duration = now.signed_duration_since(commit_time);

    Some(format_relative_time(duration))
}

/// 時間単位の定数（秒）
const MINUTE: i64 = 60;
const HOUR: i64 = 3600;
const DAY: i64 = 86400;
const WEEK: i64 = 604800;
const MONTH: i64 = 2592000;
const YEAR: i64 = 31536000;

/// 相対時間を表示用にフォーマット
///
/// # Format examples
/// - < 1分: "just now"
/// - < 1時間: "{n}m ago"
/// - < 1日: "{n}h ago"
/// - < 1週間: "{n}d ago"
/// - < 1ヶ月: "{n}w ago"
/// - < 1年: "{n}mo ago"
/// - それ以上: "{n}y ago"
fn format_relative_time(duration: chrono::Duration) -> String {
    let seconds = duration.num_seconds();

    match seconds {
        s if s < MINUTE => "just now".to_string(),
        s if s < HOUR => format!("{}m ago", s / MINUTE),
        s if s < DAY => format!("{}h ago", s / HOUR),
        s if s < WEEK => format!("{}d ago", s / DAY),
        s if s < MONTH => format!("{}w ago", s / WEEK),
        s if s < YEAR => format!("{}mo ago", s / MONTH),
        s => format!("{}y ago", s / YEAR),
    }
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
            is_main: false,
            sync_status: None,
            change_status: None,
            last_activity: None,
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
            is_main: true,
            sync_status: None,
            change_status: None,
            last_activity: None,
        };
        assert_eq!(worktree.short_head(), "abc1234");
    }
}
