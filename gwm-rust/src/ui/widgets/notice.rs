//! 通知ウィジェット（成功/エラー）
//!
//! 操作結果を表示するためのボックス型ウィジェットです。

use ratatui::{
    buffer::Buffer,
    layout::Rect,
    style::{Color, Modifier, Style},
    widgets::{Block, Borders, Widget},
};

use crate::error::{GwmError, Suggestion};

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
    /// 詳細情報（キーと値のペア）
    details: Vec<(String, String)>,
    /// 提案リスト
    suggestions: Vec<Suggestion>,
}

impl<'a> NoticeWidget<'a> {
    /// 成功通知を作成
    pub fn success(title: &'a str, messages: &'a [String]) -> Self {
        Self {
            variant: NoticeVariant::Success,
            title,
            messages,
            details: Vec::new(),
            suggestions: Vec::new(),
        }
    }

    /// エラー通知を作成
    pub fn error(title: &'a str, messages: &'a [String]) -> Self {
        Self {
            variant: NoticeVariant::Error,
            title,
            messages,
            details: Vec::new(),
            suggestions: Vec::new(),
        }
    }

    /// 詳細情報を追加
    pub fn with_details(mut self, details: Vec<(String, String)>) -> Self {
        self.details = details;
        self
    }

    /// 提案を追加
    pub fn with_suggestions(mut self, suggestions: Vec<Suggestion>) -> Self {
        self.suggestions = suggestions;
        self
    }

    /// GwmErrorから構造化エラー通知を作成
    pub fn from_gwm_error(error: &GwmError) -> Self {
        let title_str = error.title();
        let messages = vec![error.to_string()];

        let error_details = error.details();
        let mut details = Vec::new();

        if let Some(ref path) = error_details.path {
            details.push(("Path".to_string(), path.display().to_string()));
        }
        if let Some(ref branch) = error_details.branch {
            details.push(("Branch".to_string(), branch.clone()));
        }
        for (key, value) in error_details.extra {
            details.push((key, value));
        }

        let suggestions = error.suggestions();

        // 静的ライフタイムのためにleakを使用（TUI表示用の一時的なウィジェット）
        let title: &'static str = Box::leak(title_str.to_string().into_boxed_str());
        let messages: &'static [String] = Box::leak(messages.into_boxed_slice());

        Self {
            variant: NoticeVariant::Error,
            title,
            messages,
            details,
            suggestions,
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

        let mut current_y = inner.y;

        // タイトル行（アイコン + タイトル）
        let title_line = format!("{} {}", icon, self.title);
        buf.set_string(
            inner.x,
            current_y,
            &title_line,
            Style::default().fg(color).add_modifier(Modifier::BOLD),
        );
        current_y += 2;

        // メッセージ
        for msg in self.messages.iter() {
            if current_y >= inner.y + inner.height {
                break;
            }
            buf.set_string(inner.x, current_y, msg, Style::default().fg(Color::White));
            current_y += 1;
        }

        // 詳細情報
        if !self.details.is_empty() {
            current_y += 1;
            for (key, value) in &self.details {
                if current_y >= inner.y + inner.height {
                    break;
                }
                let detail_line = format!("{}: ", key);
                buf.set_string(
                    inner.x,
                    current_y,
                    &detail_line,
                    Style::default().fg(Color::Gray),
                );
                buf.set_string(
                    inner.x + detail_line.len() as u16,
                    current_y,
                    value,
                    Style::default().fg(Color::Cyan),
                );
                current_y += 1;
            }
        }

        // 提案
        if !self.suggestions.is_empty() {
            current_y += 1;
            if current_y < inner.y + inner.height {
                buf.set_string(
                    inner.x,
                    current_y,
                    "Suggestions:",
                    Style::default()
                        .fg(Color::White)
                        .add_modifier(Modifier::BOLD),
                );
                current_y += 1;
            }

            for (i, suggestion) in self.suggestions.iter().enumerate() {
                if current_y >= inner.y + inner.height {
                    break;
                }
                let suggestion_line = format!("  {}. {}", i + 1, suggestion.description);
                buf.set_string(
                    inner.x,
                    current_y,
                    &suggestion_line,
                    Style::default().fg(Color::White),
                );
                current_y += 1;

                if let Some(ref cmd) = suggestion.command {
                    if current_y < inner.y + inner.height {
                        let cmd_line = format!("     $ {}", cmd);
                        buf.set_string(
                            inner.x,
                            current_y,
                            &cmd_line,
                            Style::default().fg(Color::Cyan),
                        );
                        current_y += 1;
                    }
                }
            }
        }

        // 続行のヒント
        current_y += 1;
        if current_y < inner.y + inner.height {
            buf.set_string(
                inner.x,
                current_y,
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

    #[test]
    fn test_notice_success_variant() {
        // 成功バリアントの確認
        let messages = vec!["Worktree created".to_string()];
        let notice = NoticeWidget::success("Done", &messages);

        assert!(matches!(notice.variant, NoticeVariant::Success));
        assert_eq!(notice.messages.len(), 1);
    }

    #[test]
    fn test_notice_error_variant() {
        // エラーバリアントの確認
        let messages = vec!["Failed to create worktree".to_string()];
        let notice = NoticeWidget::error("Error", &messages);

        assert!(matches!(notice.variant, NoticeVariant::Error));
        assert_eq!(notice.messages.len(), 1);
    }

    #[test]
    fn test_notice_multiple_messages() {
        // 複数メッセージの確認
        let messages = vec![
            "Path: /path/to/worktree".to_string(),
            "Branch: feature/test".to_string(),
            "Hooks: completed".to_string(),
        ];
        let notice = NoticeWidget::success("Worktree created!", &messages);

        assert_eq!(notice.messages.len(), 3);
        assert_eq!(notice.messages[0], "Path: /path/to/worktree");
        assert_eq!(notice.messages[1], "Branch: feature/test");
        assert_eq!(notice.messages[2], "Hooks: completed");
    }

    #[test]
    fn test_notice_empty_messages() {
        // メッセージなしの確認
        let messages: Vec<String> = vec![];
        let notice = NoticeWidget::success("Success", &messages);

        assert_eq!(notice.messages.len(), 0);
    }

    #[test]
    fn test_notice_variant_debug() {
        // Debug トレイト実装の確認
        let success = NoticeVariant::Success;
        let error = NoticeVariant::Error;

        assert_eq!(format!("{:?}", success), "Success");
        assert_eq!(format!("{:?}", error), "Error");
    }

    #[test]
    fn test_notice_with_details() {
        let messages = vec!["Test".to_string()];
        let details = vec![
            ("Path".to_string(), "/path/to/worktree".to_string()),
            ("Branch".to_string(), "feature/test".to_string()),
        ];
        let notice = NoticeWidget::error("Error", &messages).with_details(details.clone());

        assert_eq!(notice.details.len(), 2);
        assert_eq!(notice.details[0].0, "Path");
        assert_eq!(notice.details[1].1, "feature/test");
    }

    #[test]
    fn test_notice_with_suggestions() {
        let messages = vec!["Test".to_string()];
        let suggestions = vec![
            Suggestion::new("Do this"),
            Suggestion::with_command("Run this", "git status"),
        ];
        let notice = NoticeWidget::error("Error", &messages).with_suggestions(suggestions);

        assert_eq!(notice.suggestions.len(), 2);
        assert_eq!(notice.suggestions[0].description, "Do this");
        assert!(notice.suggestions[0].command.is_none());
        assert_eq!(notice.suggestions[1].description, "Run this");
        assert_eq!(
            notice.suggestions[1].command,
            Some("git status".to_string())
        );
    }

    #[test]
    fn test_notice_from_gwm_error() {
        let error = GwmError::BranchExists("feature/test".to_string());
        let notice = NoticeWidget::from_gwm_error(&error);

        assert!(matches!(notice.variant, NoticeVariant::Error));
        assert_eq!(notice.title, "Branch already exists");
        assert!(!notice.suggestions.is_empty());
    }

    #[test]
    fn test_notice_from_gwm_error_with_path() {
        let error = GwmError::UncommittedChanges {
            path: std::path::PathBuf::from("/path/to/worktree"),
        };
        let notice = NoticeWidget::from_gwm_error(&error);

        assert!(matches!(notice.variant, NoticeVariant::Error));
        assert_eq!(notice.title, "Uncommitted changes");
        assert!(!notice.details.is_empty());
        assert_eq!(notice.details[0].0, "Path");
    }

    #[test]
    fn test_notice_chaining() {
        let messages = vec!["Test".to_string()];
        let details = vec![("Key".to_string(), "Value".to_string())];
        let suggestions = vec![Suggestion::new("Suggestion")];

        let notice = NoticeWidget::error("Error", &messages)
            .with_details(details)
            .with_suggestions(suggestions);

        assert_eq!(notice.details.len(), 1);
        assert_eq!(notice.suggestions.len(), 1);
    }
}
