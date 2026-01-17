//! 通知ウィジェット（成功/エラー）
//!
//! 操作結果を表示するためのボックス型ウィジェットです。

use ratatui::{
    buffer::Buffer,
    layout::Rect,
    style::{Color, Modifier, Style},
    widgets::{Block, Borders, Widget},
};
use unicode_width::UnicodeWidthStr;

use crate::error::Suggestion;

/// テキストを指定幅で折り返して行のリストを返す
///
/// Unicode文字の表示幅を考慮して折り返しを行う。
/// 単語境界での折り返しは行わず、表示幅に収まるように文字単位で分割する。
fn wrap_text(text: &str, max_width: usize) -> Vec<String> {
    if max_width == 0 {
        return vec![];
    }

    let mut lines = Vec::new();
    let mut current_line = String::new();
    let mut current_width = 0;

    for ch in text.chars() {
        let ch_width = UnicodeWidthStr::width(ch.to_string().as_str());

        if current_width + ch_width > max_width {
            // 現在の行を確定して新しい行を開始
            if !current_line.is_empty() {
                lines.push(current_line);
                current_line = String::new();
                current_width = 0;
            }
        }

        current_line.push(ch);
        current_width += ch_width;
    }

    // 残りの文字を追加
    if !current_line.is_empty() {
        lines.push(current_line);
    }

    // 空の入力の場合は空行を1つ返す
    if lines.is_empty() && !text.is_empty() {
        lines.push(String::new());
    }

    lines
}

/// プレフィックス付きテキストを折り返して行のリストを返す
///
/// 最初の行にはプレフィックスを付け、2行目以降はプレフィックスと同じ幅のインデントを付ける。
fn wrap_text_with_prefix(prefix: &str, text: &str, max_width: usize) -> Vec<String> {
    let prefix_width = UnicodeWidthStr::width(prefix);
    if prefix_width >= max_width {
        // プレフィックスだけで幅を超える場合
        return vec![format!("{}{}", prefix, text)];
    }

    let text_width = max_width - prefix_width;
    let wrapped = wrap_text(text, text_width);

    let indent = " ".repeat(prefix_width);
    wrapped
        .into_iter()
        .enumerate()
        .map(|(i, line)| {
            if i == 0 {
                format!("{}{}", prefix, line)
            } else {
                format!("{}{}", indent, line)
            }
        })
        .collect()
}

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

    /// 必要な高さを計算（ボーダー込み、折り返し考慮）
    ///
    /// # Arguments
    /// * `width` - 描画領域の幅（ボーダー込み）
    pub fn required_height(&self, width: u16) -> u16 {
        // ボーダーの幅を差し引いて内部幅を計算
        let inner_width = if width > 2 { (width - 2) as usize } else { 1 };

        let mut height: u16 = 2; // ボーダー上下

        height += 2; // タイトル行 + 空行

        // メッセージの折り返しを考慮
        for msg in self.messages.iter() {
            let lines = wrap_text(msg, inner_width);
            height += lines.len().max(1) as u16;
        }

        if !self.details.is_empty() {
            height += 1; // 空行
            for (key, value) in &self.details {
                let prefix = format!("{}: ", key);
                let lines = wrap_text_with_prefix(&prefix, value, inner_width);
                height += lines.len().max(1) as u16;
            }
        }

        if !self.suggestions.is_empty() {
            height += 2; // 空行 + "Suggestions:"
            for (i, s) in self.suggestions.iter().enumerate() {
                let prefix = format!("  {}. ", i + 1);
                let lines = wrap_text_with_prefix(&prefix, &s.description, inner_width);
                height += lines.len().max(1) as u16;

                if let Some(ref cmd) = s.command {
                    let cmd_prefix = "     $ ";
                    let cmd_lines = wrap_text_with_prefix(cmd_prefix, cmd, inner_width);
                    height += cmd_lines.len().max(1) as u16;
                }
            }
        }

        height += 2; // 空行 + "Press any key..."

        height
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
        let inner_width = inner.width as usize;

        // タイトル行（アイコン + タイトル）
        let title_line = format!("{} {}", icon, self.title);
        buf.set_string(
            inner.x,
            current_y,
            &title_line,
            Style::default().fg(color).add_modifier(Modifier::BOLD),
        );
        current_y += 2;

        // メッセージ（折り返し対応）
        for msg in self.messages.iter() {
            let wrapped_lines = wrap_text(msg, inner_width);
            for line in wrapped_lines {
                if current_y >= inner.y + inner.height {
                    break;
                }
                buf.set_string(inner.x, current_y, &line, Style::default().fg(Color::White));
                current_y += 1;
            }
        }

        // 詳細情報（折り返し対応）
        if !self.details.is_empty() {
            current_y += 1;
            for (key, value) in &self.details {
                if current_y >= inner.y + inner.height {
                    break;
                }
                let prefix = format!("{}: ", key);
                let wrapped_lines = wrap_text_with_prefix(&prefix, value, inner_width);

                for (line_idx, line) in wrapped_lines.iter().enumerate() {
                    if current_y >= inner.y + inner.height {
                        break;
                    }
                    if line_idx == 0 {
                        // 最初の行: キー部分をGray、値部分をCyanで描画
                        let prefix_width = UnicodeWidthStr::width(prefix.as_str());
                        buf.set_string(
                            inner.x,
                            current_y,
                            &prefix,
                            Style::default().fg(Color::Gray),
                        );
                        if line.len() > prefix.len() {
                            buf.set_string(
                                inner.x + prefix_width as u16,
                                current_y,
                                &line[prefix.len()..],
                                Style::default().fg(Color::Cyan),
                            );
                        }
                    } else {
                        // 2行目以降: インデント付きでCyan
                        buf.set_string(inner.x, current_y, line, Style::default().fg(Color::Cyan));
                    }
                    current_y += 1;
                }
            }
        }

        // 提案（折り返し対応）
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
                let prefix = format!("  {}. ", i + 1);
                let wrapped_lines =
                    wrap_text_with_prefix(&prefix, &suggestion.description, inner_width);

                for line in &wrapped_lines {
                    if current_y >= inner.y + inner.height {
                        break;
                    }
                    buf.set_string(inner.x, current_y, line, Style::default().fg(Color::White));
                    current_y += 1;
                }

                if let Some(ref cmd) = suggestion.command {
                    let cmd_prefix = "     $ ";
                    let cmd_lines = wrap_text_with_prefix(cmd_prefix, cmd, inner_width);
                    for cmd_line in &cmd_lines {
                        if current_y >= inner.y + inner.height {
                            break;
                        }
                        buf.set_string(
                            inner.x,
                            current_y,
                            cmd_line,
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

    #[test]
    fn test_notice_required_height_simple() {
        // シンプルなメッセージの場合（十分な幅を指定）
        let messages = vec!["Test message".to_string()];
        let notice = NoticeWidget::success("Success!", &messages);
        // border(2) + title+空行(2) + messages(1) + 空行+hint(2) = 7
        assert_eq!(notice.required_height(80), 7);
    }

    #[test]
    fn test_notice_required_height_multiple_messages() {
        // 複数メッセージの場合
        let messages = vec![
            "Message 1".to_string(),
            "Message 2".to_string(),
            "Message 3".to_string(),
        ];
        let notice = NoticeWidget::success("Success!", &messages);
        // border(2) + title+空行(2) + messages(3) + 空行+hint(2) = 9
        assert_eq!(notice.required_height(80), 9);
    }

    #[test]
    fn test_notice_required_height_with_details() {
        // 詳細情報付きの場合
        let messages = vec!["Test".to_string()];
        let details = vec![
            ("Path".to_string(), "/path/to/worktree".to_string()),
            ("Branch".to_string(), "feature/test".to_string()),
        ];
        let notice = NoticeWidget::error("Error", &messages).with_details(details);
        // border(2) + title+空行(2) + messages(1) + 空行(1) + details(2) + 空行+hint(2) = 10
        assert_eq!(notice.required_height(80), 10);
    }

    #[test]
    fn test_notice_required_height_with_suggestions() {
        // 提案付きの場合
        let messages = vec!["Test".to_string()];
        let suggestions = vec![
            Suggestion::new("Do this"),
            Suggestion::with_command("Run this", "git status"),
        ];
        let notice = NoticeWidget::error("Error", &messages).with_suggestions(suggestions);
        // border(2) + title+空行(2) + messages(1) + 空行+Suggestions:(2) + suggestion1(1) + suggestion2+cmd(2) + 空行+hint(2) = 12
        assert_eq!(notice.required_height(80), 12);
    }

    #[test]
    fn test_notice_required_height_full() {
        // 全要素付きの場合
        let messages = vec!["Error message".to_string()];
        let details = vec![("Key".to_string(), "Value".to_string())];
        let suggestions = vec![Suggestion::with_command("Fix it", "git fix")];
        let notice = NoticeWidget::error("Error", &messages)
            .with_details(details)
            .with_suggestions(suggestions);
        // border(2) + title+空行(2) + messages(1) + 空行(1) + details(1) + 空行+Suggestions:(2) + suggestion+cmd(2) + 空行+hint(2) = 13
        assert_eq!(notice.required_height(80), 13);
    }

    #[test]
    fn test_notice_required_height_with_wrapping() {
        // 折り返しが発生する場合
        // 短いメッセージ（70文字未満）
        let short_message = "Short message that fits in one line".to_string();
        let messages = vec![short_message];
        let notice = NoticeWidget::success("Success!", &messages);

        // 幅80（十分広い）では折り返しなし = 7行
        // border(2) + title+空行(2) + messages(1) + 空行+hint(2) = 7
        assert_eq!(notice.required_height(80), 7);

        // 長いメッセージでテスト
        let long_message = "This is a very long message that should wrap to multiple lines when the width is narrow enough to cause text wrapping".to_string();
        let messages_long = vec![long_message];
        let notice_long = NoticeWidget::success("Success!", &messages_long);

        // 幅22（内部幅20）では折り返しあり
        // 約119文字のメッセージが幅20で6行になる
        let height_narrow = notice_long.required_height(22);
        assert!(
            height_narrow > 7,
            "Narrow width should cause wrapping, got {}",
            height_narrow
        );
    }
}
