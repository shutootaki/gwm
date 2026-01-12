//! 選択リストウィジェット
//!
//! インクリメンタル検索付きの選択リストを提供します。

use ratatui::{
    buffer::Buffer,
    layout::Rect,
    style::{Color, Modifier, Style},
    text::{Line, Span},
    widgets::{Block, Borders, Widget},
};

use crate::ui::{SelectItem, TextInputState};
use crate::utils::format_relative_time;

/// 選択リストウィジェット
pub struct SelectListWidget<'a> {
    /// タイトル
    title: &'a str,
    /// プレースホルダー
    placeholder: &'a str,
    /// 検索入力状態
    input: &'a TextInputState,
    /// 全アイテム
    items: &'a [SelectItem],
    /// フィルタリング後のインデックス
    filtered_indices: &'a [usize],
    /// 選択中のインデックス
    selected_index: usize,
    /// スクロールオフセット
    scroll_offset: usize,
    /// 最大表示数
    max_display: usize,
}

impl<'a> SelectListWidget<'a> {
    /// 新しいSelectListWidgetを作成
    #[allow(clippy::too_many_arguments)]
    pub fn new(
        title: &'a str,
        placeholder: &'a str,
        input: &'a TextInputState,
        items: &'a [SelectItem],
        filtered_indices: &'a [usize],
        selected_index: usize,
        scroll_offset: usize,
        max_display: usize,
    ) -> Self {
        Self {
            title,
            placeholder,
            input,
            items,
            filtered_indices,
            selected_index,
            scroll_offset,
            max_display,
        }
    }
}

impl Widget for SelectListWidget<'_> {
    fn render(self, area: Rect, buf: &mut Buffer) {
        if area.width < 20 || area.height < 10 {
            return;
        }

        let mut y = area.y;

        // タイトル
        let title_style = Style::default()
            .fg(Color::Cyan)
            .add_modifier(Modifier::BOLD);
        buf.set_string(area.x, y, self.title, title_style);
        y += 2;

        // 統計情報
        let stats = format!(
            "{} / {} items • {} of {}",
            self.filtered_indices.len(),
            self.items.len(),
            if self.filtered_indices.is_empty() {
                0
            } else {
                self.selected_index + 1
            },
            self.filtered_indices.len(),
        );
        buf.set_string(area.x, y, &stats, Style::default().fg(Color::DarkGray));
        y += 2;

        // 検索入力
        buf.set_string(
            area.x,
            y,
            self.placeholder,
            Style::default().fg(Color::DarkGray),
        );
        y += 1;

        // プロンプトと入力
        buf.set_string(
            area.x,
            y,
            "❯ ",
            Style::default()
                .fg(Color::Cyan)
                .add_modifier(Modifier::BOLD),
        );

        let before_cursor = self.input.text_before_cursor();
        buf.set_string(
            area.x + 2,
            y,
            &before_cursor,
            Style::default().fg(Color::White),
        );

        let cursor_x = area.x + 2 + before_cursor.chars().count() as u16;
        if cursor_x < area.x + area.width {
            buf.set_string(cursor_x, y, "█", Style::default().fg(Color::Cyan));
        }

        let after_cursor = self.input.text_after_cursor();
        if cursor_x + 1 < area.x + area.width {
            buf.set_string(
                cursor_x + 1,
                y,
                &after_cursor,
                Style::default().fg(Color::White),
            );
        }

        y += 2;

        // 結果リスト
        if self.filtered_indices.is_empty() {
            buf.set_string(
                area.x,
                y,
                "No matches found",
                Style::default().fg(Color::Red),
            );
            y += 2;
        } else {
            // 上に隠れた要素数
            if self.scroll_offset > 0 {
                let msg = format!("↑ {} more", self.scroll_offset);
                buf.set_string(area.x, y, &msg, Style::default().fg(Color::Yellow));
                y += 1;
            }

            // 表示アイテム
            let visible_end =
                (self.scroll_offset + self.max_display).min(self.filtered_indices.len());
            for display_idx in self.scroll_offset..visible_end {
                if y >= area.y + area.height - 8 {
                    break;
                }

                let item_idx = self.filtered_indices[display_idx];
                let item = &self.items[item_idx];
                let is_selected = display_idx == self.selected_index;

                let (prefix, style) = if is_selected {
                    (
                        "▶ ",
                        Style::default()
                            .fg(Color::Cyan)
                            .add_modifier(Modifier::BOLD),
                    )
                } else {
                    ("  ", Style::default().fg(Color::White))
                };

                buf.set_string(area.x, y, prefix, style);
                buf.set_string(area.x + 2, y, &item.label, style);
                y += 1;
            }

            // 下に隠れた要素数
            let hidden_below = self.filtered_indices.len().saturating_sub(visible_end);
            if hidden_below > 0 {
                let msg = format!("↓ {} more", hidden_below);
                buf.set_string(area.x, y, &msg, Style::default().fg(Color::Yellow));
                y += 1;
            }

            y += 1;

            // プレビュー（選択中のアイテム）
            if !self.filtered_indices.is_empty() && y + 6 < area.y + area.height {
                let selected_item_idx = self.filtered_indices[self.selected_index];
                let selected_item = &self.items[selected_item_idx];

                let block = Block::default()
                    .borders(Borders::ALL)
                    .border_style(Style::default().fg(Color::DarkGray))
                    .title("Preview");

                let preview_height = if selected_item.metadata.is_some() {
                    6
                } else {
                    3
                };
                let preview_width = area.width.min(60);
                let preview_area = Rect::new(area.x, y, preview_width, preview_height);
                block.render(preview_area, buf);

                buf.set_string(
                    area.x + 2,
                    y + 1,
                    &selected_item.label,
                    Style::default()
                        .fg(Color::Cyan)
                        .add_modifier(Modifier::BOLD),
                );

                if let Some(ref metadata) = selected_item.metadata {
                    let relative_time = format_relative_time(&metadata.last_commit_date);
                    buf.set_string(
                        area.x + 2,
                        y + 2,
                        format!("Updated: {}", relative_time),
                        Style::default().fg(Color::DarkGray),
                    );
                    buf.set_string(
                        area.x + 2,
                        y + 3,
                        format!("By: {}", metadata.last_committer_name),
                        Style::default().fg(Color::DarkGray),
                    );

                    // コミットメッセージを切り詰め
                    let max_msg_len = (preview_width as usize).saturating_sub(18);
                    let commit_msg = if metadata.last_commit_message.len() > max_msg_len {
                        format!("{}...", &metadata.last_commit_message[..max_msg_len - 3])
                    } else {
                        metadata.last_commit_message.clone()
                    };
                    buf.set_string(
                        area.x + 2,
                        y + 4,
                        format!("Last commit: {}", commit_msg),
                        Style::default().fg(Color::DarkGray),
                    );
                }

                y += preview_height + 1;
            }
        }

        // ヘルプ
        if y < area.y + area.height {
            let help_line = Line::from(vec![
                Span::styled("↑/↓", Style::default().fg(Color::Cyan)),
                Span::raw(" navigate • "),
                Span::styled("Enter", Style::default().fg(Color::Green)),
                Span::raw(" select • "),
                Span::styled("Esc", Style::default().fg(Color::Red)),
                Span::raw(" cancel"),
            ]);
            buf.set_line(area.x, y, &help_line, area.width);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_select_list_widget_creation() {
        let input = TextInputState::new();
        let items = vec![SelectItem {
            label: "Test".to_string(),
            value: "test".to_string(),
            description: None,
            metadata: None,
        }];
        let filtered_indices = vec![0];

        let widget = SelectListWidget::new(
            "Title",
            "Search...",
            &input,
            &items,
            &filtered_indices,
            0,
            0,
            10,
        );

        assert_eq!(widget.title, "Title");
        assert_eq!(widget.selected_index, 0);
    }
}
