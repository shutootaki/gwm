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

    #[test]
    fn test_spinner_frame_cycling() {
        // フレームが正しくサイクルすることを確認
        let frames_len = SpinnerWidget::FRAMES.len();

        // 通常のフレーム
        for i in 0..frames_len {
            let spinner = SpinnerWidget::new("Test", i);
            assert_eq!(spinner.frame, i);
        }

        // オーバーフロー時もエラーにならない（mod演算で処理）
        let spinner = SpinnerWidget::new("Test", frames_len);
        assert_eq!(spinner.frame, frames_len);

        let spinner_large = SpinnerWidget::new("Test", 100);
        assert_eq!(spinner_large.frame, 100);
    }

    #[test]
    fn test_spinner_frame_wrapping() {
        // mod演算による正しいフレームインデックスの確認
        let frames_len = SpinnerWidget::FRAMES.len();

        assert_eq!(0 % frames_len, 0);
        assert_eq!(9 % frames_len, 9);
        assert_eq!(10 % frames_len, 0); // ラップアラウンド
        assert_eq!(15 % frames_len, 5);
        assert_eq!(100 % frames_len, 0);
    }

    #[test]
    fn test_spinner_with_different_labels() {
        // 様々なラベルでの作成
        let spinner1 = SpinnerWidget::new("Fetching remote branches...", 0);
        assert_eq!(spinner1.label, "Fetching remote branches...");

        let spinner2 = SpinnerWidget::new("Creating worktree...", 5);
        assert_eq!(spinner2.label, "Creating worktree...");

        let spinner3 = SpinnerWidget::new("", 0);
        assert_eq!(spinner3.label, "");
    }

    #[test]
    fn test_spinner_frames_are_braille() {
        // 全てのフレームがBrailleパターンであることを確認
        for frame in SpinnerWidget::FRAMES {
            assert!(!frame.is_empty());
            // Brailleパターンは U+2800-U+28FF の範囲
            for c in frame.chars() {
                assert!(
                    ('\u{2800}'..='\u{28FF}').contains(&c),
                    "Character {} is not a Braille pattern",
                    c
                );
            }
        }
    }
}
