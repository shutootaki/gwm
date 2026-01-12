//! 確認ダイアログウィジェット
//!
//! フック実行の確認UIを提供します。

use ratatui::{
    buffer::Buffer,
    layout::Rect,
    style::{Color, Modifier, Style},
    text::{Line, Span},
    widgets::{Block, Borders, Widget},
};

use crate::ui::ConfirmChoice;

/// 確認ダイアログウィジェット
pub struct ConfirmWidget<'a> {
    /// タイトル
    title: &'a str,
    /// メッセージ
    message: &'a str,
    /// 実行されるコマンド
    commands: &'a [String],
    /// 現在の選択
    selected: ConfirmChoice,
}

impl<'a> ConfirmWidget<'a> {
    /// 新しいConfirmWidgetを作成
    pub fn new(
        title: &'a str,
        message: &'a str,
        commands: &'a [String],
        selected: ConfirmChoice,
    ) -> Self {
        Self {
            title,
            message,
            commands,
            selected,
        }
    }
}

impl Widget for ConfirmWidget<'_> {
    fn render(self, area: Rect, buf: &mut Buffer) {
        if area.width < 40 || area.height < 12 {
            return;
        }

        let mut y = area.y;

        // タイトル
        let title_style = Style::default()
            .fg(Color::Yellow)
            .add_modifier(Modifier::BOLD);
        buf.set_string(area.x, y, self.title, title_style);
        y += 2;

        // メッセージ
        buf.set_string(area.x, y, self.message, Style::default().fg(Color::White));
        y += 2;

        // コマンドリスト
        if !self.commands.is_empty() {
            let block = Block::default()
                .borders(Borders::ALL)
                .border_style(Style::default().fg(Color::DarkGray))
                .title("Commands to execute");

            let cmd_height = (self.commands.len() as u16 + 2).min(8);
            let cmd_width = area.width.min(60);
            let cmd_area = Rect::new(area.x, y, cmd_width, cmd_height);
            block.render(cmd_area, buf);

            for (i, cmd) in self.commands.iter().enumerate() {
                if y + 1 + i as u16 >= cmd_area.y + cmd_area.height - 1 {
                    break;
                }
                buf.set_string(
                    area.x + 2,
                    y + 1 + i as u16,
                    &format!("$ {}", cmd),
                    Style::default().fg(Color::Cyan),
                );
            }

            y += cmd_height + 1;
        }

        // 選択肢
        let choices = [ConfirmChoice::Trust, ConfirmChoice::Once, ConfirmChoice::Cancel];

        for choice in &choices {
            if y >= area.y + area.height - 2 {
                break;
            }

            let is_selected = *choice == self.selected;
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

            // 選択肢のラベル
            let label = format!("[{}] {}", choice.label().chars().next().unwrap_or('?'), choice.label());
            buf.set_string(area.x + 2, y, &label, style);

            // 説明
            buf.set_string(
                area.x + 15,
                y,
                &format!("- {}", choice.description()),
                Style::default().fg(Color::DarkGray),
            );

            y += 1;
        }

        y += 1;

        // ヘルプ
        if y < area.y + area.height {
            let help_line = Line::from(vec![
                Span::styled("↑/↓", Style::default().fg(Color::Cyan)),
                Span::raw(" navigate • "),
                Span::styled("Enter", Style::default().fg(Color::Green)),
                Span::raw(" confirm • "),
                Span::styled("T/O/C", Style::default().fg(Color::Yellow)),
                Span::raw(" quick select • "),
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
    fn test_confirm_widget_creation() {
        let commands = vec!["npm install".to_string()];
        let widget = ConfirmWidget::new(
            "Hook Confirmation",
            "The following hooks will be executed:",
            &commands,
            ConfirmChoice::Once,
        );

        assert_eq!(widget.title, "Hook Confirmation");
        assert_eq!(widget.selected, ConfirmChoice::Once);
    }
}
