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
use crate::ui::widgets::preview_helpers::{
    calculate_preview_height, render_preview_metadata, PREVIEW_MAX_WIDTH,
};
use crate::ui::{SelectItemMetadata, TextInputState};

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
    /// メタデータ（詳細情報表示用）
    pub metadata: Option<SelectItemMetadata>,
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
            metadata: None,
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

    /// メタデータを設定
    pub fn with_metadata(mut self, metadata: SelectItemMetadata) -> Self {
        self.metadata = Some(metadata);
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

    // カーソルが表示範囲の下にある場合、スクロールして見えるようにする
    if cursor_index >= scroll_offset + max_display {
        scroll_offset = cursor_index.saturating_sub(max_display - 1);
    }

    // 末尾側でのオーバースクロールを防ぐ
    scroll_offset.min(total_items.saturating_sub(max_display))
}

impl Widget for MultiSelectListWidget<'_> {
    fn render(self, area: Rect, buf: &mut Buffer) {
        if area.width < 20 || area.height < 10 {
            return;
        }

        // ===== 事前高さ計算 =====
        // レイアウト定数
        const TITLE_HEIGHT: u16 = 2; // タイトル + マージン
        const STATS_HEIGHT: u16 = 2; // 統計 + マージン
        const INPUT_HEIGHT: u16 = 2; // プレースホルダー + 入力行
        const LIST_HEADER_HEIGHT: u16 = 1; // リスト開始前のマージン
        const HELP_HEIGHT: u16 = 3; // ヘルプ2行 + マージン
        const MAX_PREVIEW_HEIGHT: u16 = 15;
        const MIN_LIST_HEIGHT: u16 = 4; // リスト領域の最小高さ

        // 選択数
        let selected_count = self.state.selected_indices.len();

        // 理想的なプレビュー高さ（最大15行に制限）
        let ideal_preview_height = if !self.state.filtered_indices.is_empty() {
            let cursor_item_idx = self.state.filtered_indices[self.state.cursor_index];
            let cursor_item = &self.state.items[cursor_item_idx];
            calculate_preview_height(&cursor_item.metadata).min(MAX_PREVIEW_HEIGHT)
        } else {
            0
        };

        // 選択済みパネル高さ
        let selected_panel_height: u16 = if selected_count > 0 {
            (selected_count.min(5) as u16) + 3 // パネル高さ + マージン
        } else {
            0
        };

        // 固定高さの合計
        let fixed_top_height = TITLE_HEIGHT + STATS_HEIGHT + INPUT_HEIGHT + LIST_HEADER_HEIGHT;

        // 利用可能な高さを計算（固定部分を除く）
        let available_height = area.height.saturating_sub(fixed_top_height + HELP_HEIGHT);

        // リスト領域に最小高さを確保しつつ、プレビュー高さを調整
        let preview_and_selected = if ideal_preview_height >= 3 {
            ideal_preview_height + 1 + selected_panel_height
        } else {
            selected_panel_height
        };

        // リスト領域とプレビュー領域の高さを計算
        let (list_max_height, preview_height) =
            if available_height >= MIN_LIST_HEIGHT + preview_and_selected {
                // 十分な高さがある場合
                (
                    available_height.saturating_sub(preview_and_selected),
                    ideal_preview_height,
                )
            } else if available_height >= MIN_LIST_HEIGHT {
                // リスト最小高さを確保し、残りをプレビューに
                let remaining = available_height.saturating_sub(MIN_LIST_HEIGHT);
                let adjusted_preview = if remaining >= 3 + selected_panel_height {
                    (remaining.saturating_sub(selected_panel_height + 1)).max(3)
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
        // リスト領域の終了位置を計算（事前計算したlist_max_heightを使用）
        let list_end_y = y + list_max_height;

        if self.state.filtered_indices.is_empty() {
            buf.set_string(
                area.x,
                y,
                "No matches found",
                Style::default().fg(Color::Red),
            );
            y += 2;
        } else {
            // ===== 実際のリスト表示可能行数に合わせてスクロール範囲を補正 =====
            // NOTE: プレビュー領域が大きいと list_max_height が小さくなるが、
            // state.max_display(デフォルト10) のままだとカーソルが画面外に出ても
            // scroll_offset が更新されず、選択中アイテムが見えなくなる。
            let list_height = list_max_height as usize;
            let total_items = self.state.filtered_indices.len();
            let cursor_index = self.state.cursor_index.min(total_items.saturating_sub(1));
            let desired_scroll_offset = self.state.scroll_offset.min(cursor_index);
            let desired_max_display = self.state.max_display.max(1);

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
                // 表示領域に収まるように、↑/↓ more の行数も考慮して安定するまで反復
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

                    // リストが狭いときは more 表示よりアイテム表示を優先
                    while (next_show_top_more as usize + next_show_bottom_more as usize) > 0
                        && list_height.saturating_sub(
                            next_show_top_more as usize + next_show_bottom_more as usize,
                        ) < min_visible_items
                    {
                        // 両方必要な場合は、上側を優先して省略（下側の方が操作上目に入りやすい）
                        if next_show_top_more && next_show_bottom_more {
                            next_show_top_more = false;
                        } else if next_show_top_more {
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

                // 最終値を確定
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
            if show_bottom_more && hidden_below > 0 && y < list_end_y {
                let msg = format!("↓ {} more", hidden_below);
                buf.set_string(area.x, y, &msg, Style::default().fg(Color::Yellow));
                y += 1;
            }

            y += 1;

            // カーソル位置のworktree詳細情報プレビュー
            // 事前計算したpreview_heightを使用
            if !self.state.filtered_indices.is_empty() && preview_height >= 3 {
                let cursor_item_idx = self.state.filtered_indices[self.state.cursor_index];
                let cursor_item = &self.state.items[cursor_item_idx];
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
                    &cursor_item.label,
                    Style::default()
                        .fg(Color::Cyan)
                        .add_modifier(Modifier::BOLD),
                );

                // メタデータの描画
                if let Some(ref metadata) = cursor_item.metadata {
                    render_preview_metadata(buf, inner, metadata, preview_width);
                }

                y += preview_height + 1;
            }

            // 選択済みプレビュー
            let selected_items: Vec<_> = self.state.selected_items();
            let selected_panel_height = (selected_items.len().min(5) + 2) as u16;
            if !selected_items.is_empty() && y + selected_panel_height < area.y + area.height {
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

                let selected_preview_height = (selected_items.len().min(5) + 2) as u16;
                let selected_preview_width = area.width.min(50);
                let selected_preview_area =
                    Rect::new(area.x, y, selected_preview_width, selected_preview_height);
                let inner = block.inner(selected_preview_area);
                block.render(selected_preview_area, buf);

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

                y += selected_preview_height + 1;
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

    #[test]
    fn test_render_keeps_cursor_visible_when_list_height_is_small() {
        use ratatui::{buffer::Buffer, layout::Rect, widgets::Widget};

        let input = TextInputState::new();
        let items: Vec<_> = (0..20)
            .map(|i| MultiSelectItem::new(format!("item-{i:02}"), format!("/path/{i:02}")))
            .collect();

        let mut state = MultiSelectState::new(items);
        state.cursor_index = 6;
        state.scroll_offset = 0;
        state.max_display = 10;

        // プレビュー領域を含めるとリスト領域が最小に近くなる高さ
        let area = Rect::new(0, 0, 80, 17);
        let mut buf = Buffer::empty(area);
        MultiSelectListWidget::new("Title", "Search...", &input, &state).render(area, &mut buf);

        let mut cursor_line = None;
        for y in 0..area.height {
            let line: String = (0..area.width)
                .map(|x| buf.cell((x, y)).unwrap().symbol().to_string())
                .collect();
            if line.contains("▶") {
                cursor_line = Some(line);
                break;
            }
        }

        let cursor_line = cursor_line.expect("cursor line should be rendered");
        assert!(cursor_line.contains("item-06"));
    }
}
