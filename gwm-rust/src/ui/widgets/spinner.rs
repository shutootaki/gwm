//! ローディングスピナーウィジェット
//!
//! 非同期処理中にアニメーションを表示します。

use ratatui::{
    buffer::Buffer,
    layout::Rect,
    style::{Color, Style},
    widgets::Widget,
};

/// ローディングスピナーウィジェット
pub struct SpinnerWidget<'a> {
    /// 表示するラベル
    label: &'a str,
    /// アニメーションフレーム番号
    frame: usize,
}

impl<'a> SpinnerWidget<'a> {
    /// Brailleパターンを使用したスピナーフレーム
    const FRAMES: &'static [&'static str] = &["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

    /// 新しいSpinnerWidgetを作成
    pub fn new(label: &'a str, frame: usize) -> Self {
        Self { label, frame }
    }
}

impl Widget for SpinnerWidget<'_> {
    fn render(self, area: Rect, buf: &mut Buffer) {
        if area.width < 3 || area.height < 1 {
            return;
        }

        let spinner_char = Self::FRAMES[self.frame % Self::FRAMES.len()];

        // スピナー文字
        buf.set_string(
            area.x,
            area.y,
            spinner_char,
            Style::default().fg(Color::Cyan),
        );

        // ラベル
        if area.width > 2 {
            buf.set_string(
                area.x + 2,
                area.y,
                self.label,
                Style::default().fg(Color::White),
            );
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_spinner_frame_count() {
        assert_eq!(SpinnerWidget::FRAMES.len(), 10);
    }

    #[test]
    fn test_spinner_creation() {
        let spinner = SpinnerWidget::new("Loading...", 0);
        assert_eq!(spinner.label, "Loading...");
        assert_eq!(spinner.frame, 0);
    }
}
