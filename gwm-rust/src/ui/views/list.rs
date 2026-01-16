//! listコマンド実装
//!
//! `gwm list` コマンドのエントリーポイントを提供します。

use serde::Serialize;

use crate::cli::{ListArgs, OutputFormat};
use crate::config::load_config;
use crate::error::Result;
use crate::git::{get_worktrees, get_worktrees_with_details, Worktree};
use crate::ui::widgets::{calculate_column_widths, truncate_and_pad, truncate_start, ColumnWidths};

/// デフォルトターミナルサイズ（幅, 高さ）
const DEFAULT_TERMINAL_SIZE: (u16, u16) = (120, 24);

/// worktreeが空の場合のメッセージを表示
fn print_empty_worktrees_message() {
    println!("\x1b[33mNo worktrees found\x1b[0m");
    println!("\x1b[90mUse \x1b[36mgwm add\x1b[90m to create one\x1b[0m");
}

/// リスト表示用の共通ヘッダーを出力
fn print_list_header(worktree_count: usize, base_path: &str) {
    println!("\x1b[1;36mWorktrees\x1b[0m");
    println!("\x1b[90mTotal: \x1b[1;37m{}\x1b[0m", worktree_count);
    println!("\x1b[90m${{B}} = {}\x1b[0m", base_path);
    println!();
}

/// SYNC列の幅
const SYNC_WIDTH: usize = 8;

/// CHANGES列の幅
const CHANGES_WIDTH: usize = 10;

/// ACTIVITY列の幅
const ACTIVITY_WIDTH: usize = 10;

/// JSON出力用の同期状態
#[derive(Serialize)]
struct SyncJson {
    ahead: usize,
    behind: usize,
}

/// JSON出力用の変更状態
#[derive(Serialize)]
struct ChangesJson {
    modified: usize,
    added: usize,
    deleted: usize,
    untracked: usize,
}

/// JSON出力用のworktree
#[derive(Serialize)]
struct WorktreeJson {
    branch: String,
    path: String,
    status: String,
    head: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    sync: Option<SyncJson>,
    #[serde(skip_serializing_if = "Option::is_none")]
    changes: Option<ChangesJson>,
    #[serde(skip_serializing_if = "Option::is_none")]
    last_activity: Option<String>,
}

/// listコマンドを実行
///
/// Gitリポジトリ内のworktree一覧を取得し、指定されたフォーマットで表示します。
pub fn run_list(args: ListArgs) -> Result<()> {
    match args.format {
        OutputFormat::Json => run_list_json(),
        OutputFormat::Names => run_list_names(),
        OutputFormat::Table => {
            if args.compact {
                run_list_compact()
            } else {
                run_list_detailed()
            }
        }
    }
}

/// 詳細表示（新レイアウト）
fn run_list_detailed() -> Result<()> {
    let config = load_config();
    let worktrees = get_worktrees_with_details()?;

    if worktrees.is_empty() {
        print_empty_worktrees_message();
        return Ok(());
    }

    // ターミナル幅を取得
    let (width, _) = crossterm::terminal::size().unwrap_or(DEFAULT_TERMINAL_SIZE);

    // 列幅計算（新カラム分を差し引く）
    let extra_width = SYNC_WIDTH + CHANGES_WIDTH + ACTIVITY_WIDTH + 3; // 余白分
    let adjusted_width = width.saturating_sub(extra_width as u16);

    let items: Vec<(String, String)> = worktrees
        .iter()
        .map(|w| (w.display_branch().to_string(), w.path.display().to_string()))
        .collect();
    let column_widths = calculate_column_widths(&items, adjusted_width);

    print_list_header(worktrees.len(), &config.worktree_base_path);

    // チルダ展開されたベースパス（パス比較用）
    let expanded_base_path = config
        .expanded_worktree_base_path()
        .map(|p| p.display().to_string())
        .unwrap_or_default();

    // テーブルヘッダー
    println!(
        "\x1b[1;36m   {:<branch$} {:^SYNC_WIDTH$} {:<CHANGES_WIDTH$} {:<path$} {:<ACTIVITY_WIDTH$}\x1b[0m",
        "BRANCH",
        "SYNC",
        "CHANGES",
        "PATH",
        "ACTIVITY",
        branch = column_widths.branch,
        path = column_widths.path,
    );
    println!(
        "\x1b[90m   {} {:^SYNC_WIDTH$} {:<CHANGES_WIDTH$} {} {:<ACTIVITY_WIDTH$}\x1b[0m",
        "═".repeat(column_widths.branch),
        "════",
        "═══════",
        "═".repeat(column_widths.path),
        "════════",
    );

    // データ行
    for worktree in &worktrees {
        print_worktree_row_detailed(worktree, &expanded_base_path, &column_widths);
    }

    println!();

    // 凡例
    println!("\x1b[90mLegend: M=Modified, D=Deleted, A=Added, U=Untracked\x1b[0m");

    Ok(())
}

/// 詳細レイアウトで1行出力
fn print_worktree_row_detailed(worktree: &Worktree, base_path: &str, widths: &ColumnWidths) {
    let status = &worktree.status;

    // ブランチ名（末尾を切り詰め）
    let branch = truncate_and_pad(worktree.display_branch(), widths.branch);

    // SYNC表示（中央寄せ）
    let sync_str = worktree
        .sync_status
        .as_ref()
        .map(|s| s.display())
        .unwrap_or_else(|| "-".to_string());
    let sync_display = format!("{:^SYNC_WIDTH$}", sync_str);
    let sync_color = if worktree.sync_status.as_ref().is_some_and(|s| s.is_synced()) {
        "\x1b[32m" // Green
    } else {
        "\x1b[37m" // White
    };

    // CHANGES表示
    let changes_str = worktree
        .change_status
        .as_ref()
        .map(|c| c.display())
        .unwrap_or_else(|| "-".to_string());
    let changes_display = format!("{:<CHANGES_WIDTH$}", changes_str);
    let changes_color = if worktree
        .change_status
        .as_ref()
        .is_some_and(|c| c.is_clean())
    {
        "\x1b[32m" // Green
    } else {
        "\x1b[33m" // Yellow
    };

    // パス短縮
    let path_str = worktree.path.display().to_string();
    let short_path = if let Some(suffix) = path_str.strip_prefix(base_path) {
        let suffix = suffix.trim_start_matches('/');
        format!("${{B}}/{}", suffix)
    } else {
        path_str
    };
    let path = truncate_start(&short_path, widths.path);

    // ACTIVITY表示
    let activity = worktree.last_activity.as_deref().unwrap_or("-");
    let activity_display = format!("{:<ACTIVITY_WIDTH$}", activity);

    // ブランチの色分け
    let branch_display = format!("{}{}\x1b[0m", status.ansi_bold_color(), branch);

    println!(
        "{}{}\x1b[0m {} {}{}\x1b[0m {}{}\x1b[0m \x1b[90m{}\x1b[0m \x1b[90m{}\x1b[0m",
        status.ansi_color(),
        status.icon(),
        branch_display,
        sync_color,
        sync_display,
        changes_color,
        changes_display,
        path,
        activity_display,
    );
}

/// コンパクト表示（従来レイアウト）
fn run_list_compact() -> Result<()> {
    let config = load_config();
    let worktrees = get_worktrees()?;

    if worktrees.is_empty() {
        print_empty_worktrees_message();
        return Ok(());
    }

    // ターミナル幅を取得
    let (width, _) = crossterm::terminal::size().unwrap_or(DEFAULT_TERMINAL_SIZE);

    // 列幅計算
    let items: Vec<(String, String)> = worktrees
        .iter()
        .map(|w| (w.display_branch().to_string(), w.path.display().to_string()))
        .collect();
    let column_widths = calculate_column_widths(&items, width);

    // HEAD列のヘッダー幅
    const HEAD_HEADER_WIDTH: usize = 10;

    print_list_header(worktrees.len(), &config.worktree_base_path);

    // チルダ展開されたベースパス（パス比較用）
    let expanded_base_path = config
        .expanded_worktree_base_path()
        .map(|p| p.display().to_string())
        .unwrap_or_default();

    // テーブルヘッダー
    println!(
        "\x1b[1;36m   {:<branch$} {:<path$} {:<HEAD_HEADER_WIDTH$}\x1b[0m",
        "BRANCH",
        "DIR_PATH",
        "HEAD",
        branch = column_widths.branch,
        path = column_widths.path,
    );
    println!(
        "\x1b[90m   {} {} {:<HEAD_HEADER_WIDTH$}\x1b[0m",
        "═".repeat(column_widths.branch),
        "═".repeat(column_widths.path),
        "══════════",
    );

    // データ行
    for worktree in &worktrees {
        print_worktree_row_compact(worktree, &expanded_base_path, &column_widths);
    }

    println!();

    // フッター
    println!(
        "\x1b[90mUse \x1b[36mgwm go [query]\x1b[90m to navigate, \x1b[36mgwm remove\x1b[90m to delete\x1b[0m"
    );

    Ok(())
}

/// コンパクトレイアウトで1行出力
fn print_worktree_row_compact(worktree: &Worktree, base_path: &str, widths: &ColumnWidths) {
    let status = &worktree.status;
    // ブランチ名は末尾を切り詰める（先頭のプレフィックスが重要なため）
    let branch = truncate_and_pad(worktree.display_branch(), widths.branch);

    // パス短縮
    let path_str = worktree.path.display().to_string();
    let short_path = if let Some(suffix) = path_str.strip_prefix(base_path) {
        let suffix = suffix.trim_start_matches('/');
        format!("${{B}}/{}", suffix)
    } else {
        path_str
    };
    let path = truncate_start(&short_path, widths.path);

    let head = worktree.short_head();

    // ブランチの色分け（アクティブの場合は太字）
    let branch_display = format!("{}{}\x1b[0m", status.ansi_bold_color(), branch);

    println!(
        "{}{}\x1b[0m {} \x1b[90m{}\x1b[0m \x1b[36m{}\x1b[0m",
        status.ansi_color(),
        status.icon(),
        branch_display,
        path,
        head,
    );
}

/// JSON出力
fn run_list_json() -> Result<()> {
    let worktrees = get_worktrees_with_details()?;

    let json_data: Vec<WorktreeJson> = worktrees
        .iter()
        .map(|w| WorktreeJson {
            branch: w.display_branch().to_string(),
            path: w.path.display().to_string(),
            status: w.status.label().to_lowercase(),
            head: w.head.clone(),
            sync: w.sync_status.as_ref().map(|s| SyncJson {
                ahead: s.ahead,
                behind: s.behind,
            }),
            changes: w.change_status.as_ref().map(|c| ChangesJson {
                modified: c.modified,
                added: c.added,
                deleted: c.deleted,
                untracked: c.untracked,
            }),
            last_activity: w.last_activity.clone(),
        })
        .collect();

    println!("{}", serde_json::to_string_pretty(&json_data)?);

    Ok(())
}

/// ブランチ名のみ出力（シェル補完用）
///
/// 各行にブランチ名を1つずつ出力します。
/// シェル補完スクリプトから呼び出されることを想定しています。
fn run_list_names() -> Result<()> {
    let worktrees = get_worktrees()?;

    for worktree in &worktrees {
        println!("{}", worktree.display_branch());
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_sync_json_construction() {
        let sync = SyncJson {
            ahead: 5,
            behind: 3,
        };
        assert_eq!(sync.ahead, 5);
        assert_eq!(sync.behind, 3);
    }

    #[test]
    fn test_changes_json_construction() {
        let changes = ChangesJson {
            modified: 1,
            added: 2,
            deleted: 3,
            untracked: 4,
        };
        assert_eq!(changes.modified, 1);
        assert_eq!(changes.added, 2);
        assert_eq!(changes.deleted, 3);
        assert_eq!(changes.untracked, 4);
    }

    #[test]
    fn test_worktree_json_serialization() {
        let json = WorktreeJson {
            branch: "feature/test".to_string(),
            path: "/path/to/worktree".to_string(),
            status: "other".to_string(),
            head: "abc1234".to_string(),
            sync: Some(SyncJson {
                ahead: 2,
                behind: 1,
            }),
            changes: Some(ChangesJson {
                modified: 3,
                added: 1,
                deleted: 0,
                untracked: 2,
            }),
            last_activity: Some("2d ago".to_string()),
        };
        let serialized = serde_json::to_string(&json).unwrap();
        assert!(serialized.contains("feature/test"));
        assert!(serialized.contains("ahead"));
    }

    #[test]
    fn test_worktree_json_skip_serializing_none() {
        let json = WorktreeJson {
            branch: "main".to_string(),
            path: "/path".to_string(),
            status: "main".to_string(),
            head: "def5678".to_string(),
            sync: None,
            changes: None,
            last_activity: None,
        };
        let serialized = serde_json::to_string(&json).unwrap();
        assert!(!serialized.contains("sync"));
        assert!(!serialized.contains("changes"));
        assert!(!serialized.contains("last_activity"));
    }

    #[test]
    fn test_default_terminal_size() {
        assert_eq!(DEFAULT_TERMINAL_SIZE, (120, 24));
    }

    #[test]
    fn test_column_width_constants() {
        assert_eq!(SYNC_WIDTH, 8);
        assert_eq!(CHANGES_WIDTH, 10);
        assert_eq!(ACTIVITY_WIDTH, 10);
    }

    #[test]
    fn test_worktree_json_all_fields() {
        let json = WorktreeJson {
            branch: "feature/x".to_string(),
            path: "/p".to_string(),
            status: "other".to_string(),
            head: "1234567".to_string(),
            sync: Some(SyncJson {
                ahead: 0,
                behind: 0,
            }),
            changes: Some(ChangesJson {
                modified: 0,
                added: 0,
                deleted: 0,
                untracked: 0,
            }),
            last_activity: Some("just now".to_string()),
        };
        let serialized = serde_json::to_string(&json).unwrap();
        assert!(serialized.contains("\"ahead\":0"));
        assert!(serialized.contains("\"modified\":0"));
    }

    #[test]
    fn test_sync_json_zero_values() {
        let sync = SyncJson {
            ahead: 0,
            behind: 0,
        };
        assert_eq!(sync.ahead, 0);
        assert_eq!(sync.behind, 0);
    }
}
