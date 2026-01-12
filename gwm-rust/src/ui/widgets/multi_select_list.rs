//! 複数選択リストウィジェット
//!
//! インクリメンタル検索付きの複数選択リストを提供します。
//! removeコマンドなど、複数のworktreeを選択する場面で使用します。

use std::collections::HashSet;

use ratatui::{
    buffer::Buffer,
    layout::Rect,
    style::{Color, Modifier, Style},
    text::{Line, Span},
    widgets::{Block, Borders, Widget},
};

use crate::ui::TextInputState;

/// 複数選択可能なアイテム
#[derive(Debug, Clone)]
pub struct MultiSelectItem {
    /// 表示ラベル
    pub label: String,
    /// 値（選択時に使用）
    pub value: String,
    /// 説明（オプション）
    pub description: Option<String>,
    /// 選択不可フラグ（MAIN/ACTIVEなどに使用）
    pub disabled: bool,
    /// 選択不可の理由
    pub disabled_reason: Option<String>,
}

impl MultiSelectItem {
    /// 新しいアイテムを作成
    pub fn new(label: impl Into<String>, value: impl Into<String>) -> Self {
        Self {
            label: label.into(),
            value: value.into(),
            description: None,
            disabled: false,
            disabled_reason: None,
        }
    }

    /// 説明を設定
    pub fn with_description(mut self, description: impl Into<String>) -> Self {
        self.description = Some(description.into());
        self
    }

    /// 選択不可に設定
    pub fn disabled(mut self, reason: impl Into<String>) -> Self {
        self.disabled = true;
        self.disabled_reason = Some(reason.into());
        self
    }
}

/// 複数選択状態
///
/// ビュー側で管理し、ウィジェットに渡します。
#[derive(Debug, Clone)]
pub struct MultiSelectState {
    /// 全アイテム
    pub items: Vec<MultiSelectItem>,
    /// 選択済みインデックス（items内のインデックス）
    pub selected_indices: HashSet<usize>,
    /// カーソル位置（filtered_indices内のインデックス）
    pub cursor_index: usize,
    /// スクロールオフセット
    pub scroll_offset: usize,
    /// フィルタリング後のインデックス
    pub filtered_indices: Vec<usize>,
    /// 最大表示数
    pub max_display: usize,
}

impl MultiSelectState {
    /// 新しい状態を作成
    pub fn new(items: Vec<MultiSelectItem>) -> Self {
        let filtered_indices: Vec<usize> = (0..items.len()).collect();
        Self {
            items,
            selected_indices: HashSet::new(),
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

    /// カーソル位置のアイテムの選択をトグル
    pub fn toggle_current(&mut self) {
        if self.filtered_indices.is_empty() {
            return;
        }

        let item_idx = self.filtered_indices[self.cursor_index];

        // disabledアイテムは選択不可
        if self.items[item_idx].disabled {
            return;
        }

        if self.selected_indices.contains(&item_idx) {
            self.selected_indices.remove(&item_idx);
        } else {
            self.selected_indices.insert(item_idx);
        }
    }

    /// 全選択/全解除をトグル
    ///
    /// フィルタリング後のアイテムのうち、disabledでないものを対象とします。
    pub fn toggle_all(&mut self) {
        let selectable: Vec<usize> = self
            .filtered_indices
            .iter()
            .copied()
            .filter(|&i| !self.items[i].disabled)
            .collect();

        // 全て選択済みなら全解除、そうでなければ全選択
        let all_selected = selectable.iter().all(|i| self.selected_indices.contains(i));

        if all_selected {
            for idx in selectable {
                self.selected_indices.remove(&idx);
            }
        } else {
            for idx in selectable {
                self.selected_indices.insert(idx);
            }
        }
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
    pub fn selected_items(&self) -> Vec<&MultiSelectItem> {
        self.selected_indices
            .iter()
            .map(|&i| &self.items[i])
            .collect()
    }

    /// 選択数を取得
    pub fn selected_count(&self) -> usize {
        self.selected_indices.len()
    }

    /// 選択可能なアイテム数を取得
    pub fn selectable_count(&self) -> usize {
        self.items.iter().filter(|item| !item.disabled).count()
    }
}

/// 複数選択リストウィジェット
pub struct MultiSelectListWidget<'a> {
    /// タイトル
    title: &'a str,
    /// プレースホルダー
    placeholder: &'a str,
    /// 検索入力状態
    input: &'a TextInputState,
    /// 複数選択状態
    state: &'a MultiSelectState,
}

impl<'a> MultiSelectListWidget<'a> {
    /// 新しいウィジェットを作成
    pub fn new(
        title: &'a str,
        placeholder: &'a str,
        input: &'a TextInputState,
        state: &'a MultiSelectState,
    ) -> Self {
        Self {
            title,
            placeholder,
            input,
            state,
        }
    }
}

impl Widget for MultiSelectListWidget<'_> {
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
            "{} / {} items • {} selected",
            self.state.filtered_indices.len(),
            self.state.items.len(),
            self.state.selected_indices.len(),
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
        if self.state.filtered_indices.is_empty() {
            buf.set_string(
                area.x,
                y,
                "No matches found",
                Style::default().fg(Color::Red),
            );
            y += 2;
        } else {
            // 上に隠れた要素数
            if self.state.scroll_offset > 0 {
                let msg = format!("↑ {} more", self.state.scroll_offset);
                buf.set_string(area.x, y, &msg, Style::default().fg(Color::Yellow));
                y += 1;
            }

            // 表示アイテム
            let visible_end = (self.state.scroll_offset + self.state.max_display)
                .min(self.state.filtered_indices.len());

            for display_idx in self.state.scroll_offset..visible_end {
                if y >= area.y + area.height - 10 {
                    break;
                }

                let item_idx = self.state.filtered_indices[display_idx];
                let item = &self.state.items[item_idx];
                let is_cursor = display_idx == self.state.cursor_index;
                let is_selected = self.state.selected_indices.contains(&item_idx);

                // チェックボックスとスタイルを決定
                let (checkbox, checkbox_style) = if item.disabled {
                    ("[-]", Style::default().fg(Color::DarkGray))
                } else if is_selected {
                    ("[x]", Style::default().fg(Color::Green))
                } else {
                    ("[ ]", Style::default().fg(Color::White))
                };

                buf.set_string(area.x, y, checkbox, checkbox_style);

                // ラベルスタイルを決定
                let label_style = if item.disabled {
                    Style::default().fg(Color::DarkGray)
                } else if is_cursor {
                    Style::default()
                        .fg(Color::Cyan)
                        .add_modifier(Modifier::BOLD)
                } else {
                    Style::default().fg(Color::White)
                };

                buf.set_string(area.x + 4, y, &item.label, label_style);

                // カーソルインジケーター
                if is_cursor {
                    let indicator_x = area.x + 4 + item.label.chars().count() as u16 + 1;
                    if indicator_x < area.x + area.width {
                        buf.set_string(indicator_x, y, "◀", Style::default().fg(Color::Cyan));
                    }
                }

                // disabledの理由
                if item.disabled {
                    if let Some(ref reason) = item.disabled_reason {
                        let reason_x = area.x + 4 + item.label.chars().count() as u16 + 2;
                        if reason_x < area.x + area.width {
                            buf.set_string(
                                reason_x,
                                y,
                                format!("({})", reason),
                                Style::default().fg(Color::DarkGray),
                            );
                        }
                    }
                }

                y += 1;
            }

            // 下に隠れた要素数
            let hidden_below = self
                .state
                .filtered_indices
                .len()
                .saturating_sub(visible_end);
            if hidden_below > 0 {
                let msg = format!("↓ {} more", hidden_below);
                buf.set_string(area.x, y, &msg, Style::default().fg(Color::Yellow));
                y += 1;
            }

            y += 1;

            // 選択済みプレビュー
            if !self.state.selected_indices.is_empty() && y + 7 < area.y + area.height {
                let block = Block::default()
                    .borders(Borders::ALL)
                    .border_style(Style::default().fg(Color::Green))
                    .title("Selected");

                let selected_items: Vec<_> = self.state.selected_items();
                let preview_height = (selected_items.len().min(5) + 2) as u16;
                let preview_width = area.width.min(50);
                let preview_area = Rect::new(area.x, y, preview_width, preview_height);
                block.render(preview_area, buf);

                for (i, item) in selected_items.iter().take(5).enumerate() {
                    buf.set_string(
                        area.x + 2,
                        y + 1 + i as u16,
                        format!("• {}", item.label),
                        Style::default().fg(Color::White),
                    );
                }

                if selected_items.len() > 5 {
                    buf.set_string(
                        area.x + 2,
                        y + 6,
                        format!("... and {} more", selected_items.len() - 5),
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
                Span::styled("Space", Style::default().fg(Color::Green)),
                Span::raw(" toggle • "),
                Span::styled("Ctrl+A", Style::default().fg(Color::Yellow)),
                Span::raw(" all • "),
                Span::styled("Enter", Style::default().fg(Color::Green)),
                Span::raw(" confirm • "),
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

    fn create_test_items() -> Vec<MultiSelectItem> {
        vec![
            MultiSelectItem::new("feature/auth", "/path/auth"),
            MultiSelectItem::new("main", "/path/main").disabled("MAIN"),
            MultiSelectItem::new("feature/dashboard", "/path/dashboard"),
            MultiSelectItem::new("feature/settings", "/path/settings"),
        ]
    }

    #[test]
    fn test_multi_select_state_new() {
        let items = create_test_items();
        let state = MultiSelectState::new(items);

        assert_eq!(state.items.len(), 4);
        assert!(state.selected_indices.is_empty());
        assert_eq!(state.cursor_index, 0);
        assert_eq!(state.filtered_indices, vec![0, 1, 2, 3]);
    }

    #[test]
    fn test_toggle_current() {
        let items = create_test_items();
        let mut state = MultiSelectState::new(items);

        assert!(state.selected_indices.is_empty());

        // 最初のアイテムを選択
        state.toggle_current();
        assert!(state.selected_indices.contains(&0));

        // 再度トグルで解除
        state.toggle_current();
        assert!(!state.selected_indices.contains(&0));
    }

    #[test]
    fn test_toggle_disabled_item() {
        let items = create_test_items();
        let mut state = MultiSelectState::new(items);

        // mainにカーソルを移動
        state.cursor_index = 1;

        // disabledアイテムは選択できない
        state.toggle_current();
        assert!(!state.selected_indices.contains(&1));
    }

    #[test]
    fn test_toggle_all() {
        let items = create_test_items();
        let mut state = MultiSelectState::new(items);

        // 全選択
        state.toggle_all();

        // disabledでないものだけ選択される
        assert!(state.selected_indices.contains(&0));
        assert!(!state.selected_indices.contains(&1)); // main は disabled
        assert!(state.selected_indices.contains(&2));
        assert!(state.selected_indices.contains(&3));
        assert_eq!(state.selected_indices.len(), 3);

        // 全解除
        state.toggle_all();
        assert!(state.selected_indices.is_empty());
    }

    #[test]
    fn test_move_up_down() {
        let items = create_test_items();
        let mut state = MultiSelectState::new(items);

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
    fn test_update_filter() {
        let items = create_test_items();
        let mut state = MultiSelectState::new(items);

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
    fn test_selected_items() {
        let items = create_test_items();
        let mut state = MultiSelectState::new(items);

        state.selected_indices.insert(0);
        state.selected_indices.insert(2);

        let selected = state.selected_items();
        assert_eq!(selected.len(), 2);

        let labels: Vec<&str> = selected.iter().map(|i| i.label.as_str()).collect();
        assert!(labels.contains(&"feature/auth"));
        assert!(labels.contains(&"feature/dashboard"));
    }

    #[test]
    fn test_selectable_count() {
        let items = create_test_items();
        let state = MultiSelectState::new(items);

        // 4アイテム中、1つがdisabled
        assert_eq!(state.selectable_count(), 3);
    }
}
