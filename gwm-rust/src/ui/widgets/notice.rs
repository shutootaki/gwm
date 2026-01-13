//! 通知ウィジェット（成功/エラー）
//!
//! 操作結果を表示するためのボックス型ウィジェットです。

use ratatui::{
    buffer::Buffer,
    layout::Rect,
    style::{Color, Modifier, Style},
    widgets::{Block, Borders, Widget},
};

/// 通知の種類
#[derive(Debug, Clone, Copy)]
pub enum NoticeVariant {
    /// 成功（緑）
    Success,
    /// エラー（赤）
    Error,
}

/// 通知ウィジェット
pub struct NoticeWidget<'a> {
    /// 通知の種類
    variant: NoticeVariant,
    /// タイトル
    title: &'a str,
    /// メッセージリスト
    messages: &'a [String],
}

impl<'a> NoticeWidget<'a> {
    /// 成功通知を作成
    pub fn success(title: &'a str, messages: &'a [String]) -> Self {
        Self {
            variant: NoticeVariant::Success,
            title,
            messages,
        }
    }

    /// エラー通知を作成
    pub fn error(title: &'a str, messages: &'a [String]) -> Self {
        Self {
            variant: NoticeVariant::Error,
            title,
            messages,
        }
    }
}

impl Widget for NoticeWidget<'_> {
    fn render(self, area: Rect, buf: &mut Buffer) {
        if area.width < 10 || area.height < 3 {
            return;
        }

        let (color, icon) = match self.variant {
            NoticeVariant::Success => (Color::Green, "✓"),
            NoticeVariant::Error => (Color::Red, "✗"),
        };

        // ボーダー付きブロック
        let block = Block::default()
            .borders(Borders::ALL)
            .border_style(Style::default().fg(color));

        let inner = block.inner(area);
        block.render(area, buf);

        if inner.height < 1 {
            return;
        }

        // タイトル行（アイコン + タイトル）
        let title_line = format!("{} {}", icon, self.title);
        buf.set_string(
            inner.x,
            inner.y,
            &title_line,
            Style::default().fg(color).add_modifier(Modifier::BOLD),
        );

        // メッセージ
        for (i, msg) in self.messages.iter().enumerate() {
            let y = inner.y + 2 + i as u16;
            if y >= inner.y + inner.height {
                break;
            }
            buf.set_string(inner.x, y, msg, Style::default().fg(Color::White));
        }

        // 続行のヒント（メッセージの直後に配置）
        let hint_y = inner.y + 2 + self.messages.len() as u16 + 1;
        if hint_y < inner.y + inner.height {
            buf.set_string(
                inner.x,
                hint_y,
                "Press any key to continue...",
                Style::default().fg(Color::DarkGray),
            );
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_notice_success() {
        let messages = vec!["Test message".to_string()];
        let notice = NoticeWidget::success("Success!", &messages);
        assert_eq!(notice.title, "Success!");
    }

    #[test]
    fn test_notice_error() {
        let messages = vec!["Error message".to_string()];
        let notice = NoticeWidget::error("Error!", &messages);
        assert_eq!(notice.title, "Error!");
    }
}
