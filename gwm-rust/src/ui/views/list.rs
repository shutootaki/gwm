//! listコマンド実装
//!
//! `gwm list` コマンドのエントリーポイントを提供します。

use crate::config::load_config;
use crate::error::Result;
use crate::git::{get_worktrees, Worktree};
use crate::ui::widgets::{calculate_column_widths, truncate_and_pad, truncate_start, ColumnWidths};

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

    // 列幅計算
    let items: Vec<(String, String)> = worktrees
        .iter()
        .map(|w| (w.display_branch().to_string(), w.path.display().to_string()))
        .collect();
    let column_widths = calculate_column_widths(&items, width);

    // ヘッダー出力
    println!("\x1b[1;36mWorktrees\x1b[0m");
    println!("\x1b[90mTotal: \x1b[1;37m{}\x1b[0m", worktrees.len());

    // ベースパス凡例（表示用はチルダ付きのまま）
    println!("\x1b[90m${{B}} = {}\x1b[0m", config.worktree_base_path);
    println!();

    // チルダ展開されたベースパス（パス比較用）
    let expanded_base_path = config
        .expanded_worktree_base_path()
        .map(|p| p.display().to_string())
        .unwrap_or_default();

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
        print_worktree_row(worktree, &expanded_base_path, &column_widths);
    }

    println!();

    // フッター
    println!(
        "\x1b[90mUse \x1b[36mgwm go [query]\x1b[90m to navigate, \x1b[36mgwm remove\x1b[90m to delete\x1b[0m"
    );

    Ok(())
}

/// Worktree行を出力
fn print_worktree_row(worktree: &Worktree, base_path: &str, widths: &ColumnWidths) {
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
        "{}{} {:<STATUS_HEADER_WIDTH$}\x1b[0m {} \x1b[90m{}\x1b[0m \x1b[36m{}\x1b[0m",
        status.ansi_color(),
        status.icon(),
        status.label(),
        branch_display,
        path,
        head,
    );
}
