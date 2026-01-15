//! 複数選択リストウィジェット
//!
//! インクリメンタル検索付きの複数選択リストを提供します。
//! removeコマンドなど、複数のworktreeを選択する場面で使用します。
//! fuzzy matchingによる柔軟な検索とハイライト表示をサポートします。

use std::collections::{HashMap, HashSet};

use ratatui::{
    buffer::Buffer,
    layout::Rect,
    style::{Color, Modifier, Style},
    text::{Line, Span},
    widgets::{Block, Borders, Widget},
};
use unicode_width::UnicodeWidthChar;

use crate::ui::fuzzy::fuzzy_match;
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
    /// アイテムインデックス -> マッチ位置のマップ（ハイライト用）
    pub match_indices: HashMap<usize, Vec<usize>>,
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
            match_indices: HashMap::new(),
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

    /// フィルタリングを更新（fuzzy matching）
    ///
    /// 空のクエリの場合は全アイテムを表示（元の順序）。
    /// クエリがある場合はfuzzy matchingでフィルタリングし、スコア順にソート。
    pub fn update_filter(&mut self, query: &str) {
        self.match_indices.clear();

        if query.is_empty() {
            self.filtered_indices = (0..self.items.len()).collect();
            self.adjust_cursor_and_scroll();
            return;
        }

        // fuzzy matchingでマッチとスコアを取得
        let mut matches: Vec<(usize, i64, Vec<usize>)> = self
            .items
            .iter()
            .enumerate()
            .filter_map(|(i, item)| {
                fuzzy_match(query, &item.label).map(|m| (i, m.score, m.indices))
            })
            .collect();

        // スコア降順でソート
        matches.sort_by(|a, b| b.1.cmp(&a.1));

        self.filtered_indices = matches.iter().map(|(i, _, _)| *i).collect();
        self.match_indices = matches
            .into_iter()
            .map(|(i, _, indices)| (i, indices))
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

/// ラベルをマッチ位置ハイライト付きで描画
#[allow(clippy::too_many_arguments)]
fn render_label_with_highlight(
    buf: &mut Buffer,
    x: u16,
    y: u16,
    label: &str,
    match_indices: &[usize],
    base_style: Style,
    highlight_style: Style,
    max_width: u16,
) {
    let mut current_x = x;
    for (i, c) in label.chars().enumerate() {
        if current_x >= x + max_width {
            break;
        }
        let style = if match_indices.contains(&i) {
            highlight_style
        } else {
            base_style
        };
        buf.set_string(current_x, y, c.to_string(), style);
        // マルチバイト文字の幅を考慮
        let char_width = UnicodeWidthChar::width(c).unwrap_or(1) as u16;
        current_x += char_width;
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
        let cursor_pos = if self.state.filtered_indices.is_empty() {
            0
        } else {
            self.state.cursor_index + 1
        };
        let stats_line = Line::from(vec![
            Span::styled(
                format!(
                    "{} / {} items",
                    self.state.filtered_indices.len(),
                    self.state.items.len()
                ),
                Style::default().fg(Color::DarkGray),
            ),
            Span::styled(
                format!(" • cursor at {}", cursor_pos),
                Style::default().fg(Color::DarkGray),
            ),
            Span::styled(" • ", Style::default().fg(Color::DarkGray)),
            Span::styled(
                format!("{} selected", self.state.selected_indices.len()),
                Style::default()
                    .fg(Color::Green)
                    .add_modifier(Modifier::BOLD),
            ),
        ]);
        buf.set_line(area.x, y, &stats_line, area.width);
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
                if y >= area.y + area.height - 2 {
                    break;
                }

                let item_idx = self.state.filtered_indices[display_idx];
                let item = &self.state.items[item_idx];
                let is_cursor = display_idx == self.state.cursor_index;
                let is_selected = self.state.selected_indices.contains(&item_idx);

                // カーソルインジケーター（先頭に表示）
                let cursor_prefix = if is_cursor { "▶ " } else { "  " };
                let cursor_style = if is_cursor {
                    Style::default()
                        .fg(Color::Cyan)
                        .add_modifier(Modifier::BOLD)
                } else {
                    Style::default().fg(Color::White)
                };
                buf.set_string(area.x, y, cursor_prefix, cursor_style);

                // チェックボックスとスタイルを決定
                let (checkbox, checkbox_style) = if item.disabled {
                    ("[-]", Style::default().fg(Color::DarkGray))
                } else if is_selected {
                    (
                        "[x]",
                        Style::default()
                            .fg(Color::Green)
                            .add_modifier(Modifier::BOLD),
                    )
                } else {
                    ("[ ]", Style::default().fg(Color::Gray))
                };

                buf.set_string(area.x + 2, y, checkbox, checkbox_style);

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

                // マッチ位置がある場合はハイライト描画、なければ通常描画
                if let Some(indices) = self.state.match_indices.get(&item_idx) {
                    let highlight_style = Style::default()
                        .fg(Color::Cyan)
                        .add_modifier(Modifier::BOLD | Modifier::UNDERLINED);
                    render_label_with_highlight(
                        buf,
                        area.x + 6,
                        y,
                        &item.label,
                        indices,
                        label_style,
                        highlight_style,
                        area.width.saturating_sub(6),
                    );
                } else {
                    buf.set_string(area.x + 6, y, &item.label, label_style);
                }

                // disabledの理由
                if item.disabled {
                    if let Some(ref reason) = item.disabled_reason {
                        let reason_x = area.x + 6 + item.label.chars().count() as u16 + 1;
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
                let selected_items: Vec<_> = self.state.selected_items();
                let title = format!("Selected ({} items)", selected_items.len());
                let block = Block::default()
                    .borders(Borders::ALL)
                    .border_style(Style::default().fg(Color::Green))
                    .title(Span::styled(
                        title,
                        Style::default()
                            .fg(Color::Green)
                            .add_modifier(Modifier::BOLD),
                    ));

                let preview_height = (selected_items.len().min(5) + 2) as u16;
                let preview_width = area.width.min(50);
                let preview_area = Rect::new(area.x, y, preview_width, preview_height);
                let inner = block.inner(preview_area);
                block.render(preview_area, buf);

                for (i, item) in selected_items.iter().take(5).enumerate() {
                    buf.set_string(
                        inner.x,
                        inner.y + i as u16,
                        format!("• {}", item.label),
                        Style::default().fg(Color::Gray),
                    );
                }

                if selected_items.len() > 5 {
                    buf.set_string(
                        inner.x,
                        inner.y + 5,
                        format!("... {} more", selected_items.len() - 5),
                        Style::default().fg(Color::DarkGray),
                    );
                }

                y += preview_height + 1;
            }
        }

        // ヘルプ (2行表示)
        if y < area.y + area.height {
            let help_line1 = Line::from(vec![
                Span::styled("↑/↓", Style::default().fg(Color::Cyan)),
                Span::raw(" navigate • "),
                Span::styled("Space", Style::default().fg(Color::Yellow)),
                Span::raw(" toggle • "),
                Span::styled("Enter", Style::default().fg(Color::Green)),
                Span::raw(" confirm • "),
                Span::styled("Esc", Style::default().fg(Color::Red)),
                Span::raw(" cancel"),
            ]);
            buf.set_line(area.x, y, &help_line1, area.width);
            y += 1;
        }
        if y < area.y + area.height {
            let help_line2 = Line::from(vec![
                Span::styled("Ctrl+A", Style::default().fg(Color::Cyan)),
                Span::raw(" select all / clear all"),
            ]);
            buf.set_line(area.x, y, &help_line2, area.width);
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

        // "feature"でフィルタ（fuzzy matchingではスコア順にソートされる）
        state.update_filter("feature");
        // 全てfeatureを含むアイテムがマッチ
        assert_eq!(state.filtered_indices.len(), 3);
        assert!(state.filtered_indices.contains(&0));
        assert!(state.filtered_indices.contains(&2));
        assert!(state.filtered_indices.contains(&3));

        // "auth"でフィルタ
        state.update_filter("auth");
        assert_eq!(state.filtered_indices.len(), 1);
        assert!(state.filtered_indices.contains(&0));

        // フィルタ解除
        state.update_filter("");
        assert_eq!(state.filtered_indices, vec![0, 1, 2, 3]);
    }

    #[test]
    fn test_fuzzy_match() {
        let items = create_test_items();
        let mut state = MultiSelectState::new(items);

        // "fauth"でfuzzy match - "feature/auth"にマッチするはず
        state.update_filter("fauth");
        assert!(!state.filtered_indices.is_empty());
        // feature/authが結果に含まれる
        assert!(state.filtered_indices.contains(&0));
    }

    #[test]
    fn test_match_indices() {
        let items = create_test_items();
        let mut state = MultiSelectState::new(items);

        // フィルタリング
        state.update_filter("auth");

        // match_indicesが設定されている
        assert!(!state.match_indices.is_empty());
        // feature/authのマッチ位置が取得できる
        assert!(state.match_indices.contains_key(&0));
        let indices = state.match_indices.get(&0).unwrap();
        assert!(!indices.is_empty());
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
