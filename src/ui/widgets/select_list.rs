//! 選択リストウィジェット
//!
//! インクリメンタル検索付きの選択リストを提供します。
//! fuzzy matchingによる柔軟な検索とハイライト表示をサポートします。

use std::collections::HashMap;

use ratatui::{
    buffer::Buffer,
    layout::Rect,
    style::{Color, Modifier, Style},
    text::{Line, Span},
    widgets::{Block, Borders, Widget},
};
use unicode_width::UnicodeWidthChar;

use crate::ui::fuzzy::fuzzy_match;
use crate::ui::widgets::preview_helpers::{
    calculate_preview_height, render_preview_metadata, PREVIEW_MAX_WIDTH,
};
use crate::ui::{SelectItem, TextInputState};

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
    /// アイテムインデックス -> マッチ位置のマップ（ハイライト用）
    pub match_indices: HashMap<usize, Vec<usize>>,
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
            match_indices: HashMap::new(),
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

    /// 最大表示数を調整（画面サイズ変更時に呼び出す）
    ///
    /// 画面サイズが変わった場合に、カーソルが見えるようにスクロール位置を調整します。
    pub fn adjust_max_display(&mut self, actual_available: usize) {
        self.max_display = actual_available.max(1);
        // スクロール位置を調整（カーソルが見えるように）
        if self.cursor_index >= self.scroll_offset + self.max_display {
            self.scroll_offset = self.cursor_index.saturating_sub(self.max_display - 1);
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
    /// アイテムインデックス -> マッチ位置のマップ（ハイライト用）
    match_indices: Option<&'a HashMap<usize, Vec<usize>>>,
    /// 凡例テキスト（ヘルプ行の上に表示）
    legend: Option<&'a str>,
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
            match_indices: None,
            legend: None,
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
            match_indices: Some(&state.match_indices),
            legend: None,
        }
    }

    /// 凡例を設定
    pub fn with_legend(mut self, legend: &'a str) -> Self {
        self.legend = Some(legend);
        self
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

fn adjust_scroll_offset(
    desired_scroll_offset: usize,
    cursor_index: usize,
    max_display: usize,
    total_items: usize,
) -> usize {
    if total_items == 0 {
        return 0;
    }

    let max_display = max_display.max(1);
    let mut scroll_offset = desired_scroll_offset.min(cursor_index);

    if cursor_index >= scroll_offset + max_display {
        scroll_offset = cursor_index.saturating_sub(max_display - 1);
    }

    scroll_offset.min(total_items.saturating_sub(max_display))
}

/// Minimum terminal width required for SelectListWidget
const MIN_WIDTH: u16 = 20;
/// Minimum terminal height required for SelectListWidget
const MIN_HEIGHT: u16 = 10;

impl Widget for SelectListWidget<'_> {
    fn render(self, area: Rect, buf: &mut Buffer) {
        if area.width < MIN_WIDTH || area.height < MIN_HEIGHT {
            // Display a helpful message instead of blank screen
            let message = format!(
                "Terminal too small ({}x{}). Need {}x{}",
                area.width, area.height, MIN_WIDTH, MIN_HEIGHT
            );
            let truncated = &message[..message.len().min(area.width as usize)];
            let style = Style::default().fg(Color::Yellow);
            let y = area.y + area.height.saturating_sub(1) / 2;
            buf.set_string(area.x, y, truncated, style);
            return;
        }

        // ===== 事前高さ計算 =====
        // レイアウト定数
        const TITLE_HEIGHT: u16 = 2; // タイトル + マージン
        const STATS_HEIGHT: u16 = 2; // 統計 + マージン
        const INPUT_HEIGHT: u16 = 2; // プレースホルダー + 入力行
        const LIST_HEADER_HEIGHT: u16 = 1; // リスト開始前のマージン
        const HELP_HEIGHT: u16 = 2; // ヘルプ1行 + マージン
        const MAX_PREVIEW_HEIGHT: u16 = 15;
        const MIN_LIST_HEIGHT: u16 = 4; // リスト領域の最小高さ

        // 理想的なプレビュー高さ（最大15行に制限）
        let ideal_preview_height = if !self.filtered_indices.is_empty() {
            let selected_item_idx = self.filtered_indices[self.selected_index];
            let selected_item = &self.items[selected_item_idx];
            calculate_preview_height(&selected_item.metadata).min(MAX_PREVIEW_HEIGHT)
        } else {
            0
        };

        // 固定高さの合計
        let fixed_top_height = TITLE_HEIGHT + STATS_HEIGHT + INPUT_HEIGHT + LIST_HEADER_HEIGHT;

        // 利用可能な高さを計算（固定部分を除く）
        let available_height = area.height.saturating_sub(fixed_top_height + HELP_HEIGHT);

        // リスト領域に最小高さを確保しつつ、プレビュー高さを調整
        let preview_with_margin = if ideal_preview_height >= 3 {
            ideal_preview_height + 1
        } else {
            0
        };

        // リスト領域とプレビュー領域の高さを計算
        let (list_max_height, preview_height) =
            if available_height >= MIN_LIST_HEIGHT + preview_with_margin {
                // 十分な高さがある場合
                (
                    available_height.saturating_sub(preview_with_margin),
                    ideal_preview_height,
                )
            } else if available_height >= MIN_LIST_HEIGHT {
                // リスト最小高さを確保し、残りをプレビューに
                let remaining = available_height.saturating_sub(MIN_LIST_HEIGHT);
                let adjusted_preview = if remaining >= 4 {
                    (remaining.saturating_sub(1)).max(3)
                } else {
                    0 // プレビューを表示しない
                };
                (MIN_LIST_HEIGHT, adjusted_preview)
            } else {
                // 画面が非常に小さい場合
                (available_height, 0)
            };

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
        // リスト領域の終了位置を計算（事前計算したlist_max_heightを使用）
        let list_end_y = y + list_max_height;

        if self.filtered_indices.is_empty() {
            buf.set_string(
                area.x,
                y,
                "No matches found",
                Style::default().fg(Color::Red),
            );
            y += 2;
        } else {
            // ===== 実際のリスト表示可能行数に合わせてスクロール範囲を補正 =====
            let list_height = list_max_height as usize;
            let total_items = self.filtered_indices.len();
            let cursor_index = self.selected_index.min(total_items.saturating_sub(1));
            let desired_scroll_offset = self.scroll_offset.min(cursor_index);
            let desired_max_display = self.max_display.max(1);

            let min_visible_items = 3usize.min(list_height).max(1);
            let mut show_top_more = false;
            let mut show_bottom_more = false;
            let mut effective_max_display = if list_height > 0 {
                desired_max_display.min(list_height).max(1)
            } else {
                0
            };
            let mut effective_scroll_offset = desired_scroll_offset;

            if effective_max_display > 0 {
                for _ in 0..3 {
                    let indicator_lines = (show_top_more as usize) + (show_bottom_more as usize);
                    effective_max_display = desired_max_display
                        .min(list_height.saturating_sub(indicator_lines))
                        .max(1);
                    effective_scroll_offset = adjust_scroll_offset(
                        desired_scroll_offset,
                        cursor_index,
                        effective_max_display,
                        total_items,
                    );

                    let visible_end =
                        (effective_scroll_offset + effective_max_display).min(total_items);
                    let hidden_above = effective_scroll_offset > 0;
                    let hidden_below = visible_end < total_items;

                    let mut next_show_top_more = hidden_above;
                    let mut next_show_bottom_more = hidden_below;

                    while (next_show_top_more as usize + next_show_bottom_more as usize) > 0
                        && list_height.saturating_sub(
                            next_show_top_more as usize + next_show_bottom_more as usize,
                        ) < min_visible_items
                    {
                        // 両方必要な場合は、上側を優先して省略（下側の方が操作上目に入りやすい）
                        if next_show_top_more {
                            next_show_top_more = false;
                        } else {
                            next_show_bottom_more = false;
                        }
                    }

                    if next_show_top_more == show_top_more
                        && next_show_bottom_more == show_bottom_more
                    {
                        show_top_more = next_show_top_more;
                        show_bottom_more = next_show_bottom_more;
                        break;
                    }

                    show_top_more = next_show_top_more;
                    show_bottom_more = next_show_bottom_more;
                }

                let indicator_lines = (show_top_more as usize) + (show_bottom_more as usize);
                effective_max_display = desired_max_display
                    .min(list_height.saturating_sub(indicator_lines))
                    .max(1);
                effective_scroll_offset = adjust_scroll_offset(
                    desired_scroll_offset,
                    cursor_index,
                    effective_max_display,
                    total_items,
                );
            }

            let visible_end = (effective_scroll_offset + effective_max_display).min(total_items);

            // 上に隠れた要素数
            if show_top_more && y < list_end_y {
                let msg = format!("↑ {} more", effective_scroll_offset);
                buf.set_string(area.x, y, &msg, Style::default().fg(Color::Yellow));
                y += 1;
            }

            // 表示アイテム
            for display_idx in effective_scroll_offset..visible_end {
                // 事前計算したリスト領域の終了位置でチェック
                if y >= list_end_y {
                    break;
                }

                let item_idx = self.filtered_indices[display_idx];
                let item = &self.items[item_idx];
                let is_selected = display_idx == self.selected_index;

                let (prefix, base_style) = if is_selected {
                    (
                        "▶ ",
                        Style::default()
                            .fg(Color::Cyan)
                            .add_modifier(Modifier::BOLD),
                    )
                } else {
                    ("  ", Style::default().fg(Color::White))
                };

                buf.set_string(area.x, y, prefix, base_style);

                // マッチ位置がある場合はハイライト描画、なければ通常描画
                if let Some(indices) = self.match_indices.and_then(|m| m.get(&item_idx)) {
                    let highlight_style = Style::default()
                        .fg(Color::Cyan)
                        .add_modifier(Modifier::BOLD | Modifier::UNDERLINED);
                    render_label_with_highlight(
                        buf,
                        area.x + 2,
                        y,
                        &item.label,
                        indices,
                        base_style,
                        highlight_style,
                        area.width.saturating_sub(2),
                    );
                } else {
                    buf.set_string(area.x + 2, y, &item.label, base_style);
                }
                y += 1;
            }

            // 下に隠れた要素数
            let hidden_below = self.filtered_indices.len().saturating_sub(visible_end);
            if show_bottom_more && hidden_below > 0 && y < list_end_y {
                let msg = format!("↓ {} more", hidden_below);
                buf.set_string(area.x, y, &msg, Style::default().fg(Color::Yellow));
                y += 1;
            }

            y += 1;

            // プレビュー（Status/Sync/Recent changes 対応）
            // 事前計算したpreview_heightを使用
            if !self.filtered_indices.is_empty() && preview_height >= 3 {
                let selected_item_idx = self.filtered_indices[self.selected_index];
                let selected_item = &self.items[selected_item_idx];
                let preview_width = area.width.min(PREVIEW_MAX_WIDTH);

                let block = Block::default()
                    .borders(Borders::ALL)
                    .border_style(Style::default().fg(Color::DarkGray))
                    .title(Span::styled(
                        " Preview ",
                        Style::default()
                            .fg(Color::Yellow)
                            .add_modifier(Modifier::BOLD),
                    ));

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

                // メタデータの描画
                if let Some(ref metadata) = selected_item.metadata {
                    render_preview_metadata(buf, inner, metadata, preview_width);
                }

                y += preview_height + 1;
            }
        }

        // 凡例（設定されている場合）
        if let Some(legend) = self.legend {
            if y < area.y + area.height {
                buf.set_string(area.x, y, legend, Style::default().fg(Color::DarkGray));
                y += 1;
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
    fn test_select_state_fuzzy_match() {
        let items = create_test_items();
        let mut state = SelectState::new(items);

        // "fauth"でfuzzy match - "feature/auth"にマッチするはず
        state.update_filter("fauth");
        assert!(!state.filtered_indices.is_empty());
        // feature/authが結果に含まれる
        assert!(state.filtered_indices.contains(&0));
    }

    #[test]
    fn test_select_state_match_indices() {
        let items = create_test_items();
        let mut state = SelectState::new(items);

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
    fn test_select_state_empty_query_clears_match_indices() {
        let items = create_test_items();
        let mut state = SelectState::new(items);

        // フィルタリング
        state.update_filter("auth");
        assert!(!state.match_indices.is_empty());

        // 空クエリでmatch_indicesがクリアされる
        state.update_filter("");
        assert!(state.match_indices.is_empty());
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

    #[test]
    fn test_render_keeps_cursor_visible_when_list_height_is_small() {
        use ratatui::{buffer::Buffer, layout::Rect, widgets::Widget};

        let input = TextInputState::new();
        let items: Vec<SelectItem> = (0..20)
            .map(|i| SelectItem {
                label: format!("item-{i:02}"),
                value: format!("/path/{i:02}"),
                description: None,
                metadata: None,
            })
            .collect();
        let filtered_indices: Vec<usize> = (0..items.len()).collect();

        let widget = SelectListWidget::new(
            "Title",
            "Search...",
            &input,
            &items,
            &filtered_indices,
            6,
            0,
            10,
            None,
        );

        // プレビュー領域を含めるとリスト領域が最小に近くなる高さ
        let area = Rect::new(0, 0, 80, 16);
        let mut buf = Buffer::empty(area);
        widget.render(area, &mut buf);

        let mut cursor_line = None;
        for y in 0..area.height {
            let line: String = (0..area.width)
                .map(|x| buf.cell((x, y)).unwrap().symbol().to_string())
                .collect();
            if line.contains('▶') {
                cursor_line = Some(line);
                break;
            }
        }

        let cursor_line = cursor_line.expect("cursor line should be rendered");
        assert!(cursor_line.contains("item-06"));
    }
}
