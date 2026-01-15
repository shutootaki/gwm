//! 進捗表示ウィジェット
//!
//! 長時間操作時の進捗状況を表示します。
//!
//! - `ProgressBarWidget`: 定量進捗（プログレスバー）
//! - `StepProgressWidget`: ステップ進捗（[1/4] ✓ Step name 形式）

use ratatui::{
    buffer::Buffer,
    layout::Rect,
    style::{Color, Modifier, Style},
    widgets::Widget,
};

/// ステップの状態
#[derive(Clone, Debug, PartialEq)]
pub enum StepState {
    /// 未実行
    Pending(String),
    /// 実行中（進捗率オプション）
    InProgress(String, Option<f64>),
    /// 完了
    Completed(String),
    /// 失敗
    Failed(String),
}

impl StepState {
    /// ラベルを取得
    pub fn label(&self) -> &str {
        match self {
            StepState::Pending(s)
            | StepState::InProgress(s, _)
            | StepState::Completed(s)
            | StepState::Failed(s) => s,
        }
    }

    /// アイコンを取得
    pub fn icon(&self) -> &str {
        match self {
            StepState::Pending(_) => "○",
            StepState::InProgress(_, _) => "⠙",
            StepState::Completed(_) => "✓",
            StepState::Failed(_) => "✗",
        }
    }

    /// 色を取得
    pub fn color(&self) -> Color {
        match self {
            StepState::Pending(_) => Color::DarkGray,
            StepState::InProgress(_, _) => Color::Cyan,
            StepState::Completed(_) => Color::Green,
            StepState::Failed(_) => Color::Red,
        }
    }

    /// 完了済みかどうか
    pub fn is_completed(&self) -> bool {
        matches!(self, StepState::Completed(_))
    }

    /// 失敗したかどうか
    pub fn is_failed(&self) -> bool {
        matches!(self, StepState::Failed(_))
    }
}

/// プログレスバーウィジェット（定量進捗）
pub struct ProgressBarWidget<'a> {
    /// 表示メッセージ
    message: &'a str,
    /// 現在の進捗
    current: usize,
    /// 合計
    total: usize,
    /// バーの幅
    bar_width: usize,
}

impl<'a> ProgressBarWidget<'a> {
    /// 新しいProgressBarWidgetを作成
    pub fn new(message: &'a str, current: usize, total: usize) -> Self {
        Self {
            message,
            current,
            total,
            bar_width: 20,
        }
    }

    /// バーの幅を設定
    pub fn bar_width(mut self, width: usize) -> Self {
        self.bar_width = width;
        self
    }
}

impl Widget for ProgressBarWidget<'_> {
    fn render(self, area: Rect, buf: &mut Buffer) {
        if area.width < 10 || area.height < 1 {
            return;
        }

        let progress = if self.total > 0 {
            self.current as f64 / self.total as f64
        } else {
            0.0
        };

        let filled = (progress * self.bar_width as f64) as usize;
        let empty = self.bar_width.saturating_sub(filled);

        let bar = format!("{}{}", "━".repeat(filled), "─".repeat(empty));
        let percent = (progress * 100.0) as usize;

        let text = format!(
            "{} {} {}% ({}/{})",
            self.message, bar, percent, self.current, self.total
        );

        buf.set_string(area.x, area.y, &text, Style::default().fg(Color::Cyan));
    }
}

/// ステップ進捗ウィジェット
pub struct StepProgressWidget<'a> {
    /// タイトル
    title: &'a str,
    /// ステップ一覧
    steps: &'a [StepState],
    /// アニメーションフレーム番号
    frame: usize,
}

impl<'a> StepProgressWidget<'a> {
    /// Brailleパターンを使用したスピナーフレーム
    const SPINNER_FRAMES: &'static [&'static str] =
        &["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

    /// 新しいStepProgressWidgetを作成
    pub fn new(title: &'a str, steps: &'a [StepState]) -> Self {
        Self {
            title,
            steps,
            frame: 0,
        }
    }

    /// アニメーションフレームを設定
    pub fn frame(mut self, frame: usize) -> Self {
        self.frame = frame;
        self
    }

    /// 現在のスピナー文字を取得
    fn spinner_char(&self) -> &'static str {
        Self::SPINNER_FRAMES[self.frame % Self::SPINNER_FRAMES.len()]
    }
}

impl Widget for StepProgressWidget<'_> {
    fn render(self, area: Rect, buf: &mut Buffer) {
        if area.width < 10 || area.height < 2 {
            return;
        }

        let mut y = area.y;

        // タイトル
        buf.set_string(
            area.x,
            y,
            self.title,
            Style::default()
                .fg(Color::Cyan)
                .add_modifier(Modifier::BOLD),
        );
        y += 1;

        let total = self.steps.len();

        for (i, step) in self.steps.iter().enumerate() {
            if y >= area.y + area.height {
                break;
            }

            let step_num = format!("[{}/{}]", i + 1, total);
            let color = step.color();

            match step {
                StepState::Pending(label) => {
                    let line = format!("  {} ○ {}", step_num, label);
                    buf.set_string(area.x, y, &line, Style::default().fg(color));
                }
                StepState::InProgress(label, progress) => {
                    let prefix = format!("  {} ", step_num);
                    buf.set_string(area.x, y, &prefix, Style::default().fg(color));

                    let bar_start = area.x + prefix.chars().count() as u16;

                    if let Some(p) = progress {
                        // 進捗率付き
                        let bar_width: usize = 10;
                        let filled = (p * bar_width as f64) as usize;
                        let empty = bar_width.saturating_sub(filled);
                        let bar = format!("{}{}", "━".repeat(filled), "─".repeat(empty));
                        buf.set_string(bar_start, y, &bar, Style::default().fg(color));
                        buf.set_string(
                            bar_start + bar_width as u16 + 1,
                            y,
                            &format!("{}% {}", (p * 100.0) as usize, label),
                            Style::default().fg(color),
                        );
                    } else {
                        // スピナー表示
                        let spinner = self.spinner_char();
                        buf.set_string(
                            bar_start,
                            y,
                            &format!("{} {}", spinner, label),
                            Style::default().fg(color),
                        );
                    }
                }
                StepState::Completed(label) => {
                    let line = format!("  {} ✓ {}", step_num, label);
                    buf.set_string(area.x, y, &line, Style::default().fg(color));
                }
                StepState::Failed(label) => {
                    let line = format!("  {} ✗ {}", step_num, label);
                    buf.set_string(area.x, y, &line, Style::default().fg(color));
                }
            }

            y += 1;
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_step_state_label() {
        let pending = StepState::Pending("Test".to_string());
        assert_eq!(pending.label(), "Test");

        let in_progress = StepState::InProgress("Working".to_string(), Some(0.5));
        assert_eq!(in_progress.label(), "Working");

        let completed = StepState::Completed("Done".to_string());
        assert_eq!(completed.label(), "Done");

        let failed = StepState::Failed("Error".to_string());
        assert_eq!(failed.label(), "Error");
    }

    #[test]
    fn test_step_state_icon() {
        assert_eq!(StepState::Pending("".to_string()).icon(), "○");
        assert_eq!(StepState::InProgress("".to_string(), None).icon(), "⠙");
        assert_eq!(StepState::Completed("".to_string()).icon(), "✓");
        assert_eq!(StepState::Failed("".to_string()).icon(), "✗");
    }

    #[test]
    fn test_step_state_color() {
        assert_eq!(StepState::Pending("".to_string()).color(), Color::DarkGray);
        assert_eq!(
            StepState::InProgress("".to_string(), None).color(),
            Color::Cyan
        );
        assert_eq!(StepState::Completed("".to_string()).color(), Color::Green);
        assert_eq!(StepState::Failed("".to_string()).color(), Color::Red);
    }

    #[test]
    fn test_step_state_status_checks() {
        let completed = StepState::Completed("Done".to_string());
        assert!(completed.is_completed());
        assert!(!completed.is_failed());

        let failed = StepState::Failed("Error".to_string());
        assert!(!failed.is_completed());
        assert!(failed.is_failed());

        let pending = StepState::Pending("Waiting".to_string());
        assert!(!pending.is_completed());
        assert!(!pending.is_failed());
    }

    #[test]
    fn test_progress_bar_creation() {
        let bar = ProgressBarWidget::new("Loading", 50, 100);
        assert_eq!(bar.message, "Loading");
        assert_eq!(bar.current, 50);
        assert_eq!(bar.total, 100);
        assert_eq!(bar.bar_width, 20);
    }

    #[test]
    fn test_progress_bar_custom_width() {
        let bar = ProgressBarWidget::new("Loading", 50, 100).bar_width(30);
        assert_eq!(bar.bar_width, 30);
    }

    #[test]
    fn test_step_progress_creation() {
        let steps = vec![
            StepState::Completed("Step 1".to_string()),
            StepState::InProgress("Step 2".to_string(), Some(0.5)),
            StepState::Pending("Step 3".to_string()),
        ];
        let widget = StepProgressWidget::new("Test Progress", &steps);
        assert_eq!(widget.title, "Test Progress");
        assert_eq!(widget.steps.len(), 3);
        assert_eq!(widget.frame, 0);
    }

    #[test]
    fn test_step_progress_frame() {
        let steps = vec![StepState::Pending("Test".to_string())];
        let widget = StepProgressWidget::new("Test", &steps).frame(5);
        assert_eq!(widget.frame, 5);
    }

    #[test]
    fn test_spinner_frames_are_braille() {
        for frame in StepProgressWidget::SPINNER_FRAMES {
            assert!(!frame.is_empty());
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
