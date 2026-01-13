//! テキスト入力ウィジェット
//!
//! カーソル付きのテキスト入力フィールドを提供します。

use ratatui::{
    buffer::Buffer,
    layout::Rect,
    style::{Color, Modifier, Style},
    text::{Line, Span},
    widgets::{Block, Borders, Widget},
};

use crate::ui::TextInputState;

/// テキスト入力ウィジェット
pub struct TextInputWidget<'a> {
    /// タイトル
    title: &'a str,
    /// プレースホルダーテキスト
    placeholder: &'a str,
    /// 入力状態
    state: &'a TextInputState,
    /// バリデーションエラー
    validation_error: Option<&'a str>,
    /// プレビュー（worktreeパスなど）
    preview: Option<&'a str>,
    /// モード切替ヒントを表示するか
    show_mode_switch: bool,
}

impl<'a> TextInputWidget<'a> {
    /// 新しいTextInputWidgetを作成
    pub fn new(title: &'a str, placeholder: &'a str, state: &'a TextInputState) -> Self {
        Self {
            title,
            placeholder,
            state,
            validation_error: None,
            preview: None,
            show_mode_switch: false,
        }
    }

    /// バリデーションエラーを設定
    pub fn validation_error(mut self, error: Option<&'a str>) -> Self {
        self.validation_error = error;
        self
    }

    /// プレビューを設定
    pub fn preview(mut self, preview: Option<&'a str>) -> Self {
        self.preview = preview;
        self
    }

    /// モード切替ヒントの表示を設定
    pub fn show_mode_switch(mut self, show: bool) -> Self {
        self.show_mode_switch = show;
        self
    }
}

impl Widget for TextInputWidget<'_> {
    fn render(self, area: Rect, buf: &mut Buffer) {
        if area.width < 10 || area.height < 5 {
            return;
        }

        let mut y = area.y;

        // タイトル
        let title_style = Style::default()
            .fg(Color::Cyan)
            .add_modifier(Modifier::BOLD);
        buf.set_string(area.x, y, self.title, title_style);
        y += 2;

        // プレースホルダー
        buf.set_string(
            area.x,
            y,
            self.placeholder,
            Style::default().fg(Color::DarkGray),
        );
        y += 1;

        // 入力行
        let input_color = if self.validation_error.is_some() {
            Color::Red
        } else {
            Color::White
        };

        // プロンプト
        buf.set_string(
            area.x,
            y,
            "❯ ",
            Style::default()
                .fg(Color::Cyan)
                .add_modifier(Modifier::BOLD),
        );

        // 入力テキスト（カーソル前）
        let before_cursor = self.state.text_before_cursor();
        buf.set_string(
            area.x + 2,
            y,
            &before_cursor,
            Style::default().fg(input_color),
        );

        // カーソル
        let cursor_x = area.x + 2 + before_cursor.chars().count() as u16;
        if cursor_x < area.x + area.width {
            buf.set_string(cursor_x, y, "█", Style::default().fg(Color::Cyan));
        }

        // 入力テキスト（カーソル後）
        let after_cursor = self.state.text_after_cursor();
        if cursor_x + 1 < area.x + area.width {
            buf.set_string(
                cursor_x + 1,
                y,
                &after_cursor,
                Style::default().fg(input_color),
            );
        }

        y += 2;

        // バリデーションエラー
        if let Some(error) = self.validation_error {
            if y + 4 < area.y + area.height {
                let block = Block::default()
                    .borders(Borders::ALL)
                    .border_style(Style::default().fg(Color::Red))
                    .title("Invalid input");

                let error_width = area.width.min(60);
                let error_area = Rect::new(area.x, y, error_width, 4);
                let inner = block.inner(error_area);
                block.render(error_area, buf);

                buf.set_string(inner.x, inner.y, error, Style::default().fg(Color::Red));
                y += 5;
            }
        }

        // プレビュー
        if let Some(preview) = self.preview {
            if self.validation_error.is_none()
                && !self.state.value.trim().is_empty()
                && y + 5 < area.y + area.height
            {
                let block = Block::default()
                    .borders(Borders::ALL)
                    .border_style(Style::default().fg(Color::Green))
                    .title("Preview");

                let preview_width = area.width.min(60);
                let preview_area = Rect::new(area.x, y, preview_width, 5);
                let inner = block.inner(preview_area);
                block.render(preview_area, buf);

                buf.set_string(
                    inner.x,
                    inner.y,
                    "Worktree will be created at:",
                    Style::default().fg(Color::DarkGray),
                );
                buf.set_string(inner.x, inner.y + 1, preview, Style::default().fg(Color::Cyan));
                y += 6;
            }
        }

        // ヘルプ
        if y < area.y + area.height {
            let mut help_spans = vec![
                Span::styled("Enter", Style::default().fg(Color::Green)),
                Span::raw(" create • "),
                Span::styled("Esc", Style::default().fg(Color::Red)),
                Span::raw(" cancel"),
            ];

            if self.show_mode_switch {
                help_spans.extend(vec![
                    Span::raw(" • "),
                    Span::styled("Tab", Style::default().fg(Color::Yellow)),
                    Span::raw(" browse remote branches"),
                ]);
            }

            let help_line = Line::from(help_spans);
            buf.set_line(area.x, y, &help_line, area.width);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_text_input_widget_creation() {
        let state = TextInputState::new();
        let widget = TextInputWidget::new("Title", "Placeholder", &state);
        assert_eq!(widget.title, "Title");
        assert_eq!(widget.placeholder, "Placeholder");
    }

    #[test]
    fn test_text_input_widget_builder() {
        let state = TextInputState::new();
        let widget = TextInputWidget::new("Title", "Placeholder", &state)
            .validation_error(Some("Error"))
            .preview(Some("/path/to/preview"))
            .show_mode_switch(true);

        assert_eq!(widget.validation_error, Some("Error"));
        assert_eq!(widget.preview, Some("/path/to/preview"));
        assert!(widget.show_mode_switch);
    }
}
