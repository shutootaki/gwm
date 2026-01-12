//! listコマンド実装
//!
//! `gwm list` コマンドのエントリーポイントを提供します。

use crate::config::load_config;
use crate::error::Result;
use crate::git::{get_worktrees, Worktree, WorktreeStatus};
use crate::ui::widgets::{calculate_column_widths, truncate_start, ColumnWidths};

/// デフォルトターミナルサイズ（幅, 高さ）
const DEFAULT_TERMINAL_SIZE: (u16, u16) = (120, 24);

/// STATUS列のヘッダー幅
const STATUS_HEADER_WIDTH: usize = 14;

/// HEAD列のヘッダー幅
const HEAD_HEADER_WIDTH: usize = 10;

/// listコマンドを実行
///
/// Gitリポジトリ内のworktree一覧を取得し、
/// ANSIエスケープシーケンスを使用して色付きで表示します。
pub fn run_list() -> Result<()> {
    let config = load_config();
    let worktrees = get_worktrees()?;

    if worktrees.is_empty() {
        println!("\x1b[33mNo worktrees found\x1b[0m");
        println!("\x1b[90mUse \x1b[36mgwm add\x1b[90m to create one\x1b[0m");
        return Ok(());
    }

    // ターミナル幅を取得
    let (width, _) = crossterm::terminal::size().unwrap_or(DEFAULT_TERMINAL_SIZE);

    // 統計情報
    let stats = calculate_stats(&worktrees);

    // 列幅計算
    let items: Vec<(String, String)> = worktrees
        .iter()
        .map(|w| (w.display_branch().to_string(), w.path.display().to_string()))
        .collect();
    let column_widths = calculate_column_widths(&items, width);

    // ヘッダー出力
    println!("\x1b[1;36mWorktrees\x1b[0m");
    println!(
        "\x1b[90mTotal: \x1b[1;37m{}\x1b[0;90m | Active: \x1b[1;33m{}\x1b[0;90m | Main: \x1b[1;36m{}\x1b[0;90m | Other: \x1b[1;37m{}\x1b[0m",
        stats.total, stats.active, stats.main, stats.other
    );

    // ベースパス凡例
    println!("\x1b[90m${{B}} = {}\x1b[0m", config.worktree_base_path);
    println!();

    // テーブルヘッダー
    println!(
        "\x1b[1;36m   {:<STATUS_HEADER_WIDTH$} {:<branch$} {:<path$} {:<HEAD_HEADER_WIDTH$}\x1b[0m",
        "STATUS",
        "BRANCH",
        "DIR_PATH",
        "HEAD",
        branch = column_widths.branch,
        path = column_widths.path,
    );
    println!(
        "\x1b[90m   {:<STATUS_HEADER_WIDTH$} {} {} {:<HEAD_HEADER_WIDTH$}\x1b[0m",
        "══════",
        "═".repeat(column_widths.branch),
        "═".repeat(column_widths.path),
        "══════════",
    );

    // データ行
    for worktree in &worktrees {
        print_worktree_row(worktree, &config.worktree_base_path, &column_widths);
    }

    println!();

    // フッター
    println!(
        "\x1b[90mUse \x1b[36mgwm go [query]\x1b[90m to navigate, \x1b[36mgwm remove\x1b[90m to delete\x1b[0m"
    );

    Ok(())
}

/// Worktree統計情報
struct WorktreeStats {
    total: usize,
    active: usize,
    main: usize,
    other: usize,
}

/// Worktree統計を計算
///
/// WorktreeStatus は enum のため、各 worktree は1つのステータスのみを持ちます。
/// Active, Main, Other は排他的です。
fn calculate_stats(worktrees: &[Worktree]) -> WorktreeStats {
    WorktreeStats {
        total: worktrees.len(),
        active: worktrees
            .iter()
            .filter(|w| w.status == WorktreeStatus::Active)
            .count(),
        main: worktrees
            .iter()
            .filter(|w| w.status == WorktreeStatus::Main)
            .count(),
        other: worktrees
            .iter()
            .filter(|w| w.status == WorktreeStatus::Other)
            .count(),
    }
}

/// Worktree行を出力
fn print_worktree_row(worktree: &Worktree, base_path: &str, widths: &ColumnWidths) {
    let status = &worktree.status;
    let branch = truncate_start(worktree.display_branch(), widths.branch);

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
        "{}{} {:<STATUS_HEADER_WIDTH$}\x1b[0m {} \x1b[90m{}\x1b[0m \x1b[90m{}\x1b[0m",
        status.ansi_color(),
        status.icon(),
        status.label(),
        branch_display,
        path,
        head,
    );
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    #[test]
    fn test_calculate_stats_empty() {
        let worktrees: Vec<Worktree> = vec![];
        let stats = calculate_stats(&worktrees);
        assert_eq!(stats.total, 0);
        assert_eq!(stats.active, 0);
        assert_eq!(stats.main, 0);
        assert_eq!(stats.other, 0);
    }

    #[test]
    fn test_calculate_stats_single_main() {
        let worktrees = vec![Worktree {
            path: PathBuf::from("/path/to/main"),
            branch: "refs/heads/main".to_string(),
            head: "abc1234".to_string(),
            status: WorktreeStatus::Main,
        }];
        let stats = calculate_stats(&worktrees);
        assert_eq!(stats.total, 1);
        assert_eq!(stats.active, 0);
        assert_eq!(stats.main, 1);
        assert_eq!(stats.other, 0);
    }

    #[test]
    fn test_calculate_stats_active_main() {
        // Activeかつmainの場合
        let worktrees = vec![Worktree {
            path: PathBuf::from("/path/to/main"),
            branch: "refs/heads/main".to_string(),
            head: "abc1234".to_string(),
            status: WorktreeStatus::Active,
        }];
        let stats = calculate_stats(&worktrees);
        assert_eq!(stats.total, 1);
        assert_eq!(stats.active, 1);
        // Activeとしてカウントされるので、mainは0
        assert_eq!(stats.main, 0);
        assert_eq!(stats.other, 0);
    }

    #[test]
    fn test_calculate_stats_mixed() {
        let worktrees = vec![
            Worktree {
                path: PathBuf::from("/path/to/main"),
                branch: "refs/heads/main".to_string(),
                head: "abc1234".to_string(),
                status: WorktreeStatus::Main,
            },
            Worktree {
                path: PathBuf::from("/path/to/feature"),
                branch: "refs/heads/feature".to_string(),
                head: "def5678".to_string(),
                status: WorktreeStatus::Active,
            },
            Worktree {
                path: PathBuf::from("/path/to/other"),
                branch: "refs/heads/other".to_string(),
                head: "ghi9012".to_string(),
                status: WorktreeStatus::Other,
            },
        ];
        let stats = calculate_stats(&worktrees);
        assert_eq!(stats.total, 3);
        assert_eq!(stats.active, 1);
        assert_eq!(stats.main, 1);
        assert_eq!(stats.other, 1);
    }
}
