//! 構造化エラー表示モジュール
//!
//! エラーメッセージを構造化して、原因・詳細・対処法を明確に表示します。
//! NoticeWidgetを使用してratatuiでインライン描画します。

use std::io::stderr;

use ratatui::backend::CrosstermBackend;
use ratatui::layout::Rect;
use ratatui::{Terminal, TerminalOptions, Viewport};

use crate::error::GwmError;
use crate::ui::widgets::NoticeWidget;

/// エラー表示に必要な高さを計算
fn calculate_error_height(error: &GwmError) -> u16 {
    let mut height: u16 = 6; // border(2) + title(2) + message(1) + continue hint(1)

    let details = error.details();

    // 詳細情報
    if details.path.is_some()
        || details.branch.is_some()
        || !details.files.is_empty()
        || !details.extra.is_empty()
    {
        height += 1; // 空行

        if details.path.is_some() {
            height += 1;
        }
        if details.branch.is_some() {
            height += 1;
        }
        height += details.extra.len().min(10) as u16;

        if !details.files.is_empty() {
            height += 2; // 空行 + "Modified files:"
            height += details.files.len().min(5) as u16;
            if details.files.len() > 5 {
                height += 1; // "... and N more"
            }
        }
    }

    // Suggestions
    let suggestions = error.suggestions();
    if !suggestions.is_empty() {
        height += 2; // 空行 + "Suggestions:"
        for s in &suggestions {
            height += 1; // suggestion line
            if s.command.is_some() {
                height += 1; // command line
            }
        }
    }

    height
}

/// 構造化されたエラーをターミナルに表示（NoticeWidget使用）
pub fn print_structured_error(error: &GwmError) {
    // データをローカルに作成（ライフタイム管理）
    let title = error.title();
    let messages = vec![error.to_string()];

    let error_details = error.details();
    let mut details = Vec::new();

    if let Some(ref path) = error_details.path {
        details.push(("Path".to_string(), path.display().to_string()));
    }
    if let Some(ref branch) = error_details.branch {
        details.push(("Branch".to_string(), branch.clone()));
    }
    for (key, value) in &error_details.extra {
        details.push((key.clone(), value.clone()));
    }

    // ファイル一覧も詳細に追加
    if !error_details.files.is_empty() {
        details.push(("Modified files".to_string(), String::new()));
        for file in error_details.files.iter().take(5) {
            details.push((String::new(), file.clone()));
        }
        if error_details.files.len() > 5 {
            details.push((
                String::new(),
                format!("... and {} more", error_details.files.len() - 5),
            ));
        }
    }

    let suggestions = error.suggestions();

    // NoticeWidgetを構築
    let widget = NoticeWidget::error(title, &messages)
        .with_details(details)
        .with_suggestions(suggestions);

    // 高さを計算してインライン描画
    let height = calculate_error_height(error);

    let backend = CrosstermBackend::new(stderr());
    let options = TerminalOptions {
        viewport: Viewport::Inline(height),
    };

    match Terminal::with_options(backend, options) {
        Ok(mut terminal) => {
            let _ = terminal.draw(|frame| {
                let area = frame.area();
                // 幅を70%に制限（最小40文字）
                let max_width = (area.width * 70 / 100).max(40).min(area.width);
                let limited_area = Rect::new(area.x, area.y, max_width, area.height);
                frame.render_widget(widget, limited_area);
            });
            // 末尾に改行を追加（シェルの%表示を防ぐ）
            eprintln!();
        }
        Err(_) => {
            // フォールバック: 簡易エラー出力
            eprintln!("\x1b[31m✗ {}: {}\x1b[0m", title, error);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    #[test]
    fn test_print_structured_error_not_git_repository() {
        // テストはprintの出力をキャプチャできないため、
        // パニックしないことを確認する形でテスト
        let error = GwmError::NotGitRepository;
        print_structured_error(&error);
    }

    #[test]
    fn test_print_structured_error_branch_exists() {
        let error = GwmError::BranchExists("feature/test".to_string());
        print_structured_error(&error);
    }

    #[test]
    fn test_print_structured_error_uncommitted_changes() {
        let error = GwmError::UncommittedChanges {
            path: PathBuf::from("/path/to/worktree"),
        };
        print_structured_error(&error);
    }

    #[test]
    fn test_print_structured_error_config() {
        let error = GwmError::Config("invalid syntax".to_string());
        print_structured_error(&error);
    }
}
