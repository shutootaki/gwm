//! プレビュー描画用ヘルパー関数
//!
//! `select_list.rs` と `multi_select_list.rs` で共有するプレビュー描画機能を提供します。

use ratatui::{
    buffer::Buffer,
    layout::Rect,
    style::{Color, Style},
};

use crate::ui::SelectItemMetadata;
use crate::utils::format_relative_time;

// =============================================================================
// 定数定義
// =============================================================================

/// プレビュー領域のラベル幅（"Status:  "などのラベル部分）
pub const PREVIEW_LABEL_WIDTH: u16 = 9;

/// プレビュー領域の最大幅
pub const PREVIEW_MAX_WIDTH: u16 = 60;

/// プレビュー領域のファイルリストのインデント幅
pub const PREVIEW_FILE_INDENT: u16 = 2;

/// プレビュー領域のファイルステータス表示後のオフセット
pub const PREVIEW_FILE_PATH_OFFSET: u16 = 4;

/// 文字列切り詰め時のサフィックス
const TRUNCATION_SUFFIX: &str = "...";

/// 切り詰めサフィックスの長さ
const TRUNCATION_SUFFIX_LEN: usize = 3;

// =============================================================================
// ヘルパー関数
// =============================================================================

/// 文字列を指定した最大長に切り詰める
///
/// 文字列が最大長を超える場合は、末尾を"..."で置き換えます。
/// 最大長が切り詰めサフィックスの長さ以下の場合は、元の文字列を返します。
pub fn truncate_string(s: &str, max_len: usize) -> String {
    let char_count = s.chars().count();
    if char_count <= max_len || max_len <= TRUNCATION_SUFFIX_LEN {
        return s.to_string();
    }

    let truncated: String = s.chars().take(max_len - TRUNCATION_SUFFIX_LEN).collect();
    format!("{}{}", truncated, TRUNCATION_SUFFIX)
}

/// ラベル付きの行を描画するヘルパー
///
/// "Status:  " や "Sync:    " のような固定幅ラベルと値を描画します。
pub fn render_labeled_row(
    buf: &mut Buffer,
    x: u16,
    y: u16,
    label: &str,
    value: &str,
    value_color: Color,
) {
    buf.set_string(x, y, label, Style::default().fg(Color::DarkGray));
    buf.set_string(
        x + PREVIEW_LABEL_WIDTH,
        y,
        value,
        Style::default().fg(value_color),
    );
}

/// プレビューパネルのメタデータを描画
///
/// Status、Sync、コミット情報、変更ファイルリストを描画します。
/// inner領域の高さを超えないように描画を制限します。
pub fn render_preview_metadata(
    buf: &mut Buffer,
    inner: Rect,
    metadata: &SelectItemMetadata,
    preview_width: u16,
) {
    let max_y = inner.y + inner.height;
    let mut current_y = inner.y + 2;

    // Status: Clean/Modified/Untracked
    if let Some(ref change_status) = metadata.change_status {
        if current_y >= max_y {
            return;
        }
        render_labeled_row(
            buf,
            inner.x,
            current_y,
            "Status:  ",
            change_status.status_label(),
            change_status.status_color(),
        );
        current_y += 1;
    }

    // Sync: ↑N ↓M または ✓
    if let Some(ref sync_status) = metadata.sync_status {
        if current_y >= max_y {
            return;
        }
        let sync_color = if sync_status.is_synced() {
            Color::Green
        } else {
            Color::Yellow
        };
        render_labeled_row(
            buf,
            inner.x,
            current_y,
            "Sync:    ",
            &sync_status.display(),
            sync_color,
        );
        current_y += 1;
    }

    current_y += 1; // 空行

    // Updated
    if current_y >= max_y {
        return;
    }
    let relative_time = format_relative_time(&metadata.last_commit_date);
    buf.set_string(
        inner.x,
        current_y,
        format!("Updated: {}", relative_time),
        Style::default().fg(Color::DarkGray),
    );
    current_y += 1;

    // By
    if current_y >= max_y {
        return;
    }
    buf.set_string(
        inner.x,
        current_y,
        format!("By:      {}", metadata.last_committer_name),
        Style::default().fg(Color::DarkGray),
    );
    current_y += 1;

    // Commit message
    if current_y >= max_y {
        return;
    }
    let max_msg_len = (preview_width as usize).saturating_sub(18);
    let commit_msg = truncate_string(&metadata.last_commit_message, max_msg_len);
    buf.set_string(
        inner.x,
        current_y,
        format!("Commit:  {}", commit_msg),
        Style::default().fg(Color::DarkGray),
    );
    current_y += 1;

    // Recent changes（変更がある場合のみ）
    if let Some(ref change_status) = metadata.change_status {
        if !change_status.changed_files.is_empty() {
            current_y += 1; // 空行
            if current_y >= max_y {
                return;
            }
            buf.set_string(
                inner.x,
                current_y,
                "Recent changes:",
                Style::default().fg(Color::DarkGray),
            );
            current_y += 1;

            let max_path_len = (preview_width as usize).saturating_sub(6);
            for file in &change_status.changed_files {
                if current_y >= max_y {
                    return;
                }
                buf.set_string(
                    inner.x + PREVIEW_FILE_INDENT,
                    current_y,
                    format!("{} ", file.status),
                    Style::default().fg(file.status_color()),
                );
                let display_path = truncate_string(&file.path, max_path_len);
                buf.set_string(
                    inner.x + PREVIEW_FILE_PATH_OFFSET,
                    current_y,
                    &display_path,
                    Style::default().fg(Color::DarkGray),
                );
                current_y += 1;
            }
        }
    }
}

/// プレビューパネルの高さを動的に計算
///
/// メタデータの内容に応じて適切な高さを返します。
pub fn calculate_preview_height(metadata: &Option<SelectItemMetadata>) -> u16 {
    let Some(metadata) = metadata else {
        return 3; // メタデータなしの場合は最小高さ
    };

    let mut height = 4; // ブランチ名 + 空行 + 最小の余白

    // Status/Sync がある場合
    if metadata.change_status.is_some() {
        height += 1; // Status行
    }
    if metadata.sync_status.is_some() {
        height += 1; // Sync行
    }

    // コミット情報
    height += 4; // 空行 + Updated + By + Commit

    // Recent changes
    if let Some(ref change_status) = metadata.change_status {
        if !change_status.changed_files.is_empty() {
            height += 2 + change_status.changed_files.len().min(5) as u16; // 空行 + ヘッダー + ファイル
        }
    }

    height
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_truncate_string_short() {
        // 最大長より短い文字列はそのまま
        let result = truncate_string("hello", 10);
        assert_eq!(result, "hello");
    }

    #[test]
    fn test_truncate_string_exact() {
        // 最大長と同じ文字列はそのまま
        let result = truncate_string("hello", 5);
        assert_eq!(result, "hello");
    }

    #[test]
    fn test_truncate_string_long() {
        // 最大長より長い文字列は切り詰め
        let result = truncate_string("hello world", 8);
        assert_eq!(result, "hello...");
    }

    #[test]
    fn test_truncate_string_min_length() {
        // 最大長が切り詰めサフィックス以下の場合はそのまま
        let result = truncate_string("hello", 3);
        assert_eq!(result, "hello");
    }

    #[test]
    fn test_truncate_string_unicode() {
        // Unicode文字を含む文字列（6文字なので切り詰めなし）
        let result = truncate_string("日本語テスト", 6);
        assert_eq!(result, "日本語テスト");

        // 切り詰めが必要なケース（最大5文字）
        let result = truncate_string("日本語テスト", 5);
        assert_eq!(result, "日本...");
    }

    #[test]
    fn test_calculate_preview_height_none() {
        assert_eq!(calculate_preview_height(&None), 3);
    }
}
