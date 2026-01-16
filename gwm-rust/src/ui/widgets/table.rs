//! テーブル表示ウィジェット
//!
//! Worktree一覧の表示に使用するテーブル関連のユーティリティを提供します。

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
/// 5. 実際のデータ長に基づいて列幅を拝借
///
/// # Arguments
/// * `items` - ブランチ名とパスのペアのリスト
/// * `terminal_width` - ターミナル幅
pub fn calculate_column_widths(items: &[(String, String)], terminal_width: u16) -> ColumnWidths {
    let available = terminal_width.saturating_sub(FIXED_COLUMN_WIDTH) as usize;

    // 実際のデータ長を計算（ヘッダー文字列の長さも考慮）
    let max_branch_len = items
        .iter()
        .map(|(b, _)| b.chars().count())
        .max()
        .unwrap_or(0)
        .max("BRANCH".len());
    let max_path_len = items
        .iter()
        .map(|(_, p)| p.chars().count())
        .max()
        .unwrap_or(0)
        .max("DIR_PATH".len());

    // 4:6 の比率で基本分配
    let mut branch_width = (available as f64 * BRANCH_RATIO) as usize;
    let mut path_width = (available as f64 * PATH_RATIO) as usize;

    // 最小幅を確保
    branch_width = branch_width.max(MIN_BRANCH_WIDTH);
    path_width = path_width.max(MIN_PATH_WIDTH);

    // 上限を計算
    let branch_cap = ((available as f64 * MAX_BRANCH_RATIO) as usize).max(MIN_BRANCH_WIDTH);
    let path_cap = ((available as f64 * MAX_PATH_RATIO) as usize).max(MIN_PATH_WIDTH);

    // 拝借ロジック: ブランチ列が不足している場合、パス列から拝借
    if max_branch_len > branch_width {
        let desired = max_branch_len.min(branch_cap);
        let need = desired.saturating_sub(branch_width);
        let can_take = path_width.saturating_sub(MIN_PATH_WIDTH);
        let take = need.min(can_take);
        branch_width += take;
        path_width -= take;
    }

    // 拝借ロジック: パス列が不足している場合、ブランチ列から拝借
    if max_path_len > path_width {
        let desired = max_path_len.min(path_cap);
        let need = desired.saturating_sub(path_width);
        let can_take = branch_width.saturating_sub(MIN_BRANCH_WIDTH);
        let take = need.min(can_take);
        path_width += take;
        branch_width -= take;
    }

    // 上限を適用（ただし最小幅は保証する）
    branch_width = branch_width.min(branch_cap);
    path_width = path_width.min(path_cap);

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

/// テキストを指定幅に切り詰め（先頭を優先して残す）
///
/// 幅を超える場合は末尾を省略記号(...)に置き換えます。
/// TypeScript版の truncateAndPad と同等の動作。
///
/// # Example
/// ```ignore
/// assert_eq!(truncate_and_pad("very-long-text", 10), "very-lo...");
/// assert_eq!(truncate_and_pad("short", 10), "short     ");
/// ```
pub fn truncate_and_pad(text: &str, width: usize) -> String {
    let chars: Vec<char> = text.chars().collect();

    if chars.len() <= width {
        // 幅に満たない場合はパディング
        format!("{:<width$}", text, width = width)
    } else {
        // 末尾を省略
        let ellipsis = "...";
        let remaining = width.saturating_sub(3); // 省略記号分を引く
        if remaining == 0 {
            // 幅が3以下の場合は省略記号を切り詰める
            ".".repeat(width)
        } else {
            let truncated: String = chars[..remaining].iter().collect();
            format!("{}{}", truncated, ellipsis)
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

    #[test]
    fn test_truncate_and_pad_short() {
        assert_eq!(truncate_and_pad("short", 10), "short     ");
    }

    #[test]
    fn test_truncate_and_pad_exact() {
        assert_eq!(truncate_and_pad("exactly10!", 10), "exactly10!");
    }

    #[test]
    fn test_truncate_and_pad_long() {
        // 末尾を省略
        assert_eq!(truncate_and_pad("very-long-text", 10), "very-lo...");
    }

    #[test]
    fn test_truncate_and_pad_branch_name() {
        // ブランチ名の先頭プレフィックスが残る
        assert_eq!(
            truncate_and_pad("feature/very-long-branch-name", 20),
            "feature/very-long..."
        );
    }

    #[test]
    fn test_truncate_and_pad_width_three() {
        assert_eq!(truncate_and_pad("abcdef", 3), "...");
    }

    #[test]
    fn test_truncate_and_pad_width_two() {
        assert_eq!(truncate_and_pad("abcdef", 2), "..");
    }

    #[test]
    fn test_calculate_column_widths_borrow_from_path() {
        // ブランチ名が長い場合、パス列から幅を拝借
        let items = vec![(
            "feature/very-long-branch-name-here".to_string(),
            "/short".to_string(),
        )];
        let widths = calculate_column_widths(&items, 120);
        // ブランチ列がブランチ名の長さ（34文字）以上になる
        assert!(
            widths.branch >= 34,
            "branch width should be >= 34, got {}",
            widths.branch
        );
    }

    #[test]
    fn test_calculate_column_widths_borrow_from_branch() {
        // パス名が長い場合、ブランチ列から幅を拝借
        let items = vec![(
            "main".to_string(),
            "/very/long/path/to/some/deeply/nested/worktree/directory".to_string(),
        )];
        let widths = calculate_column_widths(&items, 120);
        // パス列がデフォルトより広くなる
        assert!(widths.path > 54); // デフォルトの4:6分配での幅より大きい
    }
}
