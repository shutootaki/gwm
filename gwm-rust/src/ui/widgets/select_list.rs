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

/// 単一選択状態
///
/// ビュー側で管理し、ウィジェットに渡します。
#[derive(Debug, Clone)]
pub struct SelectState {
    /// 全アイテム
    pub items: Vec<SelectItem>,
    /// カーソル位置（filtered_indices内のインデックス）
    pub cursor_index: usize,
    /// スクロールオフセット
    pub scroll_offset: usize,
    /// フィルタリング後のインデックス
    pub filtered_indices: Vec<usize>,
    /// 最大表示数
    pub max_display: usize,
}

impl SelectState {
    /// 新しい状態を作成
    pub fn new(items: Vec<SelectItem>) -> Self {
        let filtered_indices: Vec<usize> = (0..items.len()).collect();
        Self {
            items,
            cursor_index: 0,
            scroll_offset: 0,
            filtered_indices,
            max_display: 10,
        }
    }

    /// 最大表示数を設定
    pub fn with_max_display(mut self, max_display: usize) -> Self {
        self.max_display = max_display;
        self
    }

    /// カーソルを上に移動
    pub fn move_up(&mut self) {
        if self.cursor_index > 0 {
            self.cursor_index -= 1;
            if self.cursor_index < self.scroll_offset {
                self.scroll_offset = self.cursor_index;
            }
        }
    }

    /// カーソルを下に移動
    pub fn move_down(&mut self) {
        if self.cursor_index + 1 < self.filtered_indices.len() {
            self.cursor_index += 1;
            if self.cursor_index >= self.scroll_offset + self.max_display {
                self.scroll_offset = self.cursor_index - self.max_display + 1;
            }
        }
    }

    /// フィルタリングを更新
    pub fn update_filter(&mut self, query: &str) {
        let query_lower = query.to_lowercase();

        self.filtered_indices = self
            .items
            .iter()
            .enumerate()
            .filter(|(_, item)| item.label.to_lowercase().contains(&query_lower))
            .map(|(i, _)| i)
            .collect();

        self.adjust_cursor_and_scroll();
    }

    /// カーソルとスクロール位置を範囲内に調整
    fn adjust_cursor_and_scroll(&mut self) {
        let max_index = self.filtered_indices.len().saturating_sub(1);
        self.cursor_index = self.cursor_index.min(max_index);
        self.scroll_offset = self.scroll_offset.min(self.cursor_index);
    }

    /// 選択されたアイテムを取得
    pub fn selected_item(&self) -> Option<&SelectItem> {
        if self.filtered_indices.is_empty() {
            None
        } else {
            let item_idx = self.filtered_indices[self.cursor_index];
            Some(&self.items[item_idx])
        }
    }
}

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
    /// worktreeパスプレビュー（将来の拡張用）
    #[allow(dead_code)]
    preview: Option<&'a str>,
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
        preview: Option<&'a str>,
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
            preview,
        }
    }

    /// SelectStateを使用してウィジェットを作成
    pub fn with_state(
        title: &'a str,
        placeholder: &'a str,
        input: &'a TextInputState,
        state: &'a SelectState,
        preview: Option<&'a str>,
    ) -> Self {
        Self {
            title,
            placeholder,
            input,
            items: &state.items,
            filtered_indices: &state.filtered_indices,
            selected_index: state.cursor_index,
            scroll_offset: state.scroll_offset,
            max_display: state.max_display,
            preview,
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
                if y >= area.y + area.height - 2 {
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

            // プレビュー（TS版と同じ形式: ブランチ名 + メタデータ）
            if !self.filtered_indices.is_empty() && y + 7 < area.y + area.height {
                let selected_item_idx = self.filtered_indices[self.selected_index];
                let selected_item = &self.items[selected_item_idx];

                let block = Block::default()
                    .borders(Borders::ALL)
                    .border_style(Style::default().fg(Color::DarkGray))
                    .title(Span::styled(
                        " Preview ",
                        Style::default()
                            .fg(Color::Yellow)
                            .add_modifier(Modifier::BOLD),
                    ));

                let preview_height = if selected_item.metadata.is_some() {
                    7
                } else {
                    3
                };
                let preview_width = area.width.min(60);
                let preview_area = Rect::new(area.x, y, preview_width, preview_height);
                let inner = block.inner(preview_area);
                block.render(preview_area, buf);

                // ブランチ名（シアン色）
                buf.set_string(
                    inner.x,
                    inner.y,
                    &selected_item.label,
                    Style::default()
                        .fg(Color::Cyan)
                        .add_modifier(Modifier::BOLD),
                );

                // メタデータ（ブランチ名の後に1行空ける）
                if let Some(ref metadata) = selected_item.metadata {
                    let relative_time = format_relative_time(&metadata.last_commit_date);
                    buf.set_string(
                        inner.x,
                        inner.y + 2,
                        format!("Updated: {}", relative_time),
                        Style::default().fg(Color::DarkGray),
                    );
                    buf.set_string(
                        inner.x,
                        inner.y + 3,
                        format!("By: {}", metadata.last_committer_name),
                        Style::default().fg(Color::DarkGray),
                    );

                    // コミットメッセージを切り詰め（UTF-8安全）
                    let max_msg_len = (preview_width as usize).saturating_sub(18);
                    let commit_msg =
                        if metadata.last_commit_message.chars().count() > max_msg_len {
                            let truncated: String = metadata
                                .last_commit_message
                                .chars()
                                .take(max_msg_len.saturating_sub(3))
                                .collect();
                            format!("{}...", truncated)
                        } else {
                            metadata.last_commit_message.clone()
                        };
                    buf.set_string(
                        inner.x,
                        inner.y + 4,
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
            None,
        );

        assert_eq!(widget.title, "Title");
        assert_eq!(widget.selected_index, 0);
    }

    fn create_test_items() -> Vec<SelectItem> {
        vec![
            SelectItem {
                label: "feature/auth".to_string(),
                value: "/path/auth".to_string(),
                description: None,
                metadata: None,
            },
            SelectItem {
                label: "main".to_string(),
                value: "/path/main".to_string(),
                description: None,
                metadata: None,
            },
            SelectItem {
                label: "feature/dashboard".to_string(),
                value: "/path/dashboard".to_string(),
                description: None,
                metadata: None,
            },
            SelectItem {
                label: "feature/settings".to_string(),
                value: "/path/settings".to_string(),
                description: None,
                metadata: None,
            },
        ]
    }

    #[test]
    fn test_select_state_new() {
        let items = create_test_items();
        let state = SelectState::new(items);

        assert_eq!(state.items.len(), 4);
        assert_eq!(state.cursor_index, 0);
        assert_eq!(state.filtered_indices, vec![0, 1, 2, 3]);
        assert_eq!(state.max_display, 10);
    }

    #[test]
    fn test_select_state_move_up_down() {
        let items = create_test_items();
        let mut state = SelectState::new(items);

        assert_eq!(state.cursor_index, 0);

        state.move_down();
        assert_eq!(state.cursor_index, 1);

        state.move_down();
        assert_eq!(state.cursor_index, 2);

        state.move_up();
        assert_eq!(state.cursor_index, 1);

        // 先頭で上に行けない
        state.cursor_index = 0;
        state.move_up();
        assert_eq!(state.cursor_index, 0);

        // 末尾で下に行けない
        state.cursor_index = 3;
        state.move_down();
        assert_eq!(state.cursor_index, 3);
    }

    #[test]
    fn test_select_state_update_filter() {
        let items = create_test_items();
        let mut state = SelectState::new(items);

        // "feature"でフィルタ
        state.update_filter("feature");
        assert_eq!(state.filtered_indices, vec![0, 2, 3]);

        // "auth"でフィルタ
        state.update_filter("auth");
        assert_eq!(state.filtered_indices, vec![0]);

        // フィルタ解除
        state.update_filter("");
        assert_eq!(state.filtered_indices, vec![0, 1, 2, 3]);
    }

    #[test]
    fn test_select_state_selected_item() {
        let items = create_test_items();
        let mut state = SelectState::new(items);

        // 最初のアイテム
        let selected = state.selected_item().unwrap();
        assert_eq!(selected.label, "feature/auth");

        // カーソル移動後
        state.cursor_index = 2;
        let selected = state.selected_item().unwrap();
        assert_eq!(selected.label, "feature/dashboard");
    }

    #[test]
    fn test_select_state_selected_item_empty() {
        let state = SelectState::new(vec![]);
        assert!(state.selected_item().is_none());
    }
}
