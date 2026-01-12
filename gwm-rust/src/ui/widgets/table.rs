//! テーブル表示ウィジェット
//!
//! Worktree一覧の表示に使用するテーブル関連のユーティリティを提供します。

use ratatui::{
    buffer::Buffer,
    layout::Rect,
    style::{Color, Modifier, Style},
    widgets::Widget,
};

use crate::git::{Worktree, WorktreeStatus};

/// 列幅計算で使用する固定幅の合計
/// STATUS(14) + HEAD(10) + margins(6) = 30
const FIXED_COLUMN_WIDTH: u16 = 30;

/// ブランチ列の最小幅
const MIN_BRANCH_WIDTH: usize = 15;

/// パス列の最小幅
const MIN_PATH_WIDTH: usize = 20;

/// ブランチ列の分配比率
const BRANCH_RATIO: f64 = 0.4;

/// パス列の分配比率
const PATH_RATIO: f64 = 0.6;

/// ブランチ列の最大比率
const MAX_BRANCH_RATIO: f64 = 0.51;

/// パス列の最大比率
const MAX_PATH_RATIO: f64 = 0.72;

/// 列幅の設定
#[derive(Debug, Clone, Copy)]
pub struct ColumnWidths {
    /// BRANCH列の幅
    pub branch: usize,
    /// PATH列の幅
    pub path: usize,
}

/// 最適な列幅を計算
///
/// # アルゴリズム
/// 1. 固定幅を確保: STATUS(14) + HEAD(10) + 余白(6)
/// 2. 残り幅を BRANCH:PATH = 4:6 で分配
/// 3. 最小幅を確保: BRANCH(15), PATH(20)
/// 4. 上限を設定: BRANCH(51%), PATH(72%)
///
/// # Arguments
/// * `_items` - ブランチ名とパスのペアのリスト（将来の拡張用）
/// * `terminal_width` - ターミナル幅
pub fn calculate_column_widths(
    _items: &[(String, String)],
    terminal_width: u16,
) -> ColumnWidths {
    let available = terminal_width.saturating_sub(FIXED_COLUMN_WIDTH) as usize;

    // 4:6 の比率で分配
    let mut branch_width = (available as f64 * BRANCH_RATIO) as usize;
    let mut path_width = (available as f64 * PATH_RATIO) as usize;

    // 最小幅を確保
    branch_width = branch_width.max(MIN_BRANCH_WIDTH);
    path_width = path_width.max(MIN_PATH_WIDTH);

    // 上限を設定（ただし最小幅は保証する）
    if available > 0 {
        let max_branch = ((available as f64 * MAX_BRANCH_RATIO) as usize).max(MIN_BRANCH_WIDTH);
        let max_path = ((available as f64 * MAX_PATH_RATIO) as usize).max(MIN_PATH_WIDTH);

        branch_width = branch_width.min(max_branch);
        path_width = path_width.min(max_path);
    }

    ColumnWidths {
        branch: branch_width,
        path: path_width,
    }
}

/// テキストを指定幅に切り詰め（末尾を優先して残す）
///
/// 幅を超える場合は先頭を省略記号(…)に置き換えます。
///
/// # Example
/// ```ignore
/// assert_eq!(truncate_start("very-long-text", 10), "…long-text");
/// assert_eq!(truncate_start("short", 10), "short     ");
/// ```
pub fn truncate_start(text: &str, width: usize) -> String {
    let chars: Vec<char> = text.chars().collect();

    if chars.len() <= width {
        // 幅に満たない場合はパディング
        format!("{:<width$}", text, width = width)
    } else {
        // 先頭を省略
        let ellipsis = "…";
        let remaining = width.saturating_sub(1); // 省略記号分を引く
        if remaining == 0 {
            ellipsis.to_string()
        } else {
            let start = chars.len().saturating_sub(remaining);
            format!("{}{}", ellipsis, chars[start..].iter().collect::<String>())
        }
    }
}

/// テキストを指定幅でパディング
pub fn pad_text(text: &str, width: usize) -> String {
    format!("{:<width$}", text, width = width)
}

/// Worktree一覧テーブルウィジェット
///
/// 将来のインタラクティブUI用に準備されたratatuiウィジェットです。
/// Phase 2では直接ANSIエスケープシーケンスで出力するため、
/// このウィジェットは使用されません。
pub struct WorktreeTable<'a> {
    worktrees: &'a [Worktree],
    base_path: Option<String>,
    column_widths: ColumnWidths,
}

impl<'a> WorktreeTable<'a> {
    pub fn new(worktrees: &'a [Worktree]) -> Self {
        Self {
            worktrees,
            base_path: None,
            column_widths: ColumnWidths {
                branch: 30,
                path: 40,
            },
        }
    }

    pub fn base_path(mut self, path: String) -> Self {
        self.base_path = Some(path);
        self
    }

    pub fn column_widths(mut self, widths: ColumnWidths) -> Self {
        self.column_widths = widths;
        self
    }

    /// パス表示を短縮
    fn shorten_path(&self, path: &str) -> String {
        if let Some(ref base) = self.base_path {
            if let Some(suffix) = path.strip_prefix(base) {
                let suffix = suffix.trim_start_matches('/');
                return format!("${{B}}/{}", suffix);
            }
        }
        path.to_string()
    }
}

impl Widget for WorktreeTable<'_> {
    fn render(self, area: Rect, buf: &mut Buffer) {
        let header_style = Style::default()
            .fg(Color::Cyan)
            .add_modifier(Modifier::BOLD);
        let separator_style = Style::default().fg(Color::DarkGray);

        let mut y = area.y;

        // ヘッダー行
        let header = format!(
            "   {:<14} {:<branch$} {:<path$} {:<10}",
            "STATUS",
            "BRANCH",
            "DIR_PATH",
            "HEAD",
            branch = self.column_widths.branch,
            path = self.column_widths.path,
        );
        buf.set_string(area.x, y, &header, header_style);
        y += 1;

        // セパレーター
        let separator = format!(
            "   {:<14} {} {} {:<10}",
            "══════",
            "═".repeat(self.column_widths.branch),
            "═".repeat(self.column_widths.path),
            "══════════",
        );
        buf.set_string(area.x, y, &separator, separator_style);
        y += 1;

        // データ行
        for worktree in self.worktrees {
            if y >= area.y + area.height {
                break;
            }

            let status_style = Style::default().fg(worktree.status.color());
            let icon = worktree.status.icon();
            let label = worktree.status.label();
            let branch = truncate_start(worktree.display_branch(), self.column_widths.branch);
            let path = truncate_start(
                &self.shorten_path(&worktree.path.display().to_string()),
                self.column_widths.path,
            );
            let head = worktree.short_head();

            // アイコン + ラベル
            let status_text = format!("{} {:<8}", icon, label);
            buf.set_string(area.x, y, &status_text, status_style);

            // ブランチ（アクティブの場合は太字）
            let branch_style = if worktree.status == WorktreeStatus::Active {
                status_style.add_modifier(Modifier::BOLD)
            } else {
                Style::default().fg(Color::White)
            };
            buf.set_string(area.x + 14, y, &branch, branch_style);

            // パス
            buf.set_string(
                area.x + 14 + self.column_widths.branch as u16 + 1,
                y,
                &path,
                Style::default().fg(Color::Gray),
            );

            // HEAD
            buf.set_string(
                area.x + 14 + self.column_widths.branch as u16 + self.column_widths.path as u16 + 2,
                y,
                head,
                Style::default().fg(Color::DarkGray),
            );

            y += 1;
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_truncate_start_short() {
        assert_eq!(truncate_start("short", 10), "short     ");
    }

    #[test]
    fn test_truncate_start_exact() {
        assert_eq!(truncate_start("exactly10!", 10), "exactly10!");
    }

    #[test]
    fn test_truncate_start_long() {
        assert_eq!(truncate_start("very-long-text", 10), "…long-text");
    }

    #[test]
    fn test_truncate_start_unicode() {
        // Unicode省略記号は1文字としてカウント
        let result = truncate_start("abcdefghijk", 5);
        assert!(result.starts_with('…'));
        assert_eq!(result.chars().count(), 5);
    }

    #[test]
    fn test_truncate_start_width_one() {
        assert_eq!(truncate_start("abc", 1), "…");
    }

    #[test]
    fn test_pad_text() {
        assert_eq!(pad_text("test", 10), "test      ");
    }

    #[test]
    fn test_calculate_column_widths_normal() {
        let items = vec![
            ("main".to_string(), "/path/to/main".to_string()),
            ("feature/test".to_string(), "/path/to/feature".to_string()),
        ];
        let widths = calculate_column_widths(&items, 120);
        assert!(widths.branch >= 15);
        assert!(widths.path >= 20);
    }

    #[test]
    fn test_calculate_column_widths_narrow() {
        let items = vec![("main".to_string(), "/path".to_string())];
        let widths = calculate_column_widths(&items, 60);
        // 最小幅は確保される
        assert!(widths.branch >= 15);
        assert!(widths.path >= 20);
    }

    #[test]
    fn test_calculate_column_widths_very_narrow() {
        let items = vec![];
        let widths = calculate_column_widths(&items, 30);
        // 最小幅は確保される
        assert_eq!(widths.branch, 15);
        assert_eq!(widths.path, 20);
    }
}
