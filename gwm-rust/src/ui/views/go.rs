//! goコマンドのビュー
//!
//! worktreeへのナビゲーション機能を提供します。
//! パスを標準出力に出力することで、シェル関数と連携します。

use std::io::stdout;
use std::time::Duration;

use crossterm::{
    event::{Event, KeyCode, KeyModifiers},
    terminal::{disable_raw_mode, enable_raw_mode},
};
use ratatui::{
    backend::CrosstermBackend,
    layout::Rect,
    style::{Color, Style},
    text::{Line, Span},
    widgets::Paragraph,
    Terminal, TerminalOptions, Viewport,
};

use crate::cli::GoArgs;
use crate::error::Result;
use crate::git::get_worktrees;
use crate::ui::event::poll_event;
use crate::ui::widgets::{SelectListWidget, SelectState};
use crate::ui::{SelectItem, TextInputState};
use crate::utils::{open_in_editor, EditorType};

/// goコマンドを実行
///
/// # Arguments
/// * `args` - コマンド引数
///
/// # Returns
/// * 成功時: Ok(())
/// * 失敗時: GwmError
pub fn run_go(args: GoArgs) -> Result<()> {
    let worktrees = get_worktrees()?;

    if worktrees.is_empty() {
        eprintln!("No worktrees found.");
        return Ok(());
    }

    // Worktreeをアイテムに変換（ステータスアイコン付き）
    let items: Vec<SelectItem> = worktrees
        .iter()
        .map(|wt| SelectItem {
            label: format!("[{}] {}", wt.status.icon(), wt.display_branch()),
            value: wt.path.display().to_string(),
            description: Some(wt.path.display().to_string()),
            metadata: None,
        })
        .collect();

    // クエリで1件に絞れる場合は直接移動
    if let Some(ref query) = args.query {
        let query_lower = query.to_lowercase();
        let matches: Vec<_> = items
            .iter()
            .filter(|item| item.label.to_lowercase().contains(&query_lower))
            .collect();

        if matches.len() == 1 {
            return handle_selection(matches[0], &args);
        }

        if matches.is_empty() {
            eprintln!("No worktree matching '{}' found.", query);
            return Ok(());
        }
    }

    // TUIモードで選択
    let selected = run_go_tui(&items, args.query.as_deref())?;

    if let Some(item) = selected {
        handle_selection(&item, &args)?;
    }

    Ok(())
}

/// 選択されたworktreeを処理
fn handle_selection(item: &SelectItem, args: &GoArgs) -> Result<()> {
    let path = std::path::Path::new(&item.value);

    let editor = if args.open_code {
        Some(EditorType::VsCode)
    } else if args.open_cursor {
        Some(EditorType::Cursor)
    } else {
        None
    };

    if let Some(editor_type) = editor {
        open_in_editor(editor_type, path)?;
        let editor_name = match editor_type {
            EditorType::VsCode => "Editor",
            EditorType::Cursor => "Cursor",
        };
        println!("\x1b[32m✓\x1b[0m Opened {} in {}", item.label, editor_name);
        std::thread::sleep(std::time::Duration::from_millis(500));
    } else {
        // パスを標準出力（シェル統合用）
        println!("{}", item.value);
    }

    Ok(())
}

/// TUIモードで選択
fn run_go_tui(items: &[SelectItem], initial_query: Option<&str>) -> Result<Option<SelectItem>> {
    // ターミナル初期化（インライン表示）
    enable_raw_mode()?;
    let backend = CrosstermBackend::new(stdout());
    let options = TerminalOptions {
        viewport: Viewport::Inline(15),
    };
    let mut terminal = Terminal::with_options(backend, options)?;

    // 状態初期化
    let mut input = match initial_query {
        Some(query) => TextInputState::with_value(query.to_string()),
        None => TextInputState::new(),
    };

    let mut state = SelectState::new(items.to_vec()).with_max_display(10);

    // 初期フィルタリング（クエリがある場合）
    if !input.value.is_empty() {
        state.update_filter(&input.value);
    }

    let result = loop {
        terminal.draw(|frame| {
            let area = frame.area();

            // SelectListWidget用の領域（下1行を凡例用に確保）
            let list_area = Rect {
                height: area.height.saturating_sub(1),
                ..area
            };

            let widget = SelectListWidget::with_state(
                "Go to worktree",
                "Search worktrees...",
                &input,
                &state,
                None,
            );
            frame.render_widget(widget, list_area);

            // 凡例表示
            let legend_area = Rect {
                y: area.y + area.height.saturating_sub(1),
                height: 1,
                ..area
            };
            let legend = Line::from(vec![
                Span::styled("[*]", Style::default().fg(Color::Yellow)),
                Span::raw(" Active  "),
                Span::styled("[M]", Style::default().fg(Color::Cyan)),
                Span::raw(" Main  "),
                Span::styled("[-]", Style::default().fg(Color::White)),
                Span::raw(" Other"),
            ]);
            frame.render_widget(Paragraph::new(legend), legend_area);
        })?;

        if let Some(Event::Key(key)) = poll_event(Duration::from_millis(100))? {
            match (key.modifiers, key.code) {
                // Ctrl+C / Escでキャンセル
                (KeyModifiers::CONTROL, KeyCode::Char('c')) | (_, KeyCode::Esc) => break None,
                (_, KeyCode::Enter) => {
                    if let Some(item) = state.selected_item() {
                        break Some(item.clone());
                    }
                }
                (_, KeyCode::Up) | (KeyModifiers::CONTROL, KeyCode::Char('p')) => {
                    state.move_up();
                }
                (_, KeyCode::Down) | (KeyModifiers::CONTROL, KeyCode::Char('n')) => {
                    state.move_down();
                }
                (_, KeyCode::Backspace) => {
                    input.delete_backward();
                    state.update_filter(&input.value);
                }
                (KeyModifiers::CONTROL, KeyCode::Char('u')) => {
                    input.clear();
                    state.update_filter(&input.value);
                }
                (KeyModifiers::NONE | KeyModifiers::SHIFT, KeyCode::Char(c)) => {
                    input.insert(c);
                    state.update_filter(&input.value);
                }
                _ => {}
            }
        }
    };

    // ターミナル復元（インライン表示なのでLeaveAlternateScreenは不要）
    disable_raw_mode()?;
    // カーソルをインライン領域の外に移動
    println!();

    Ok(result)
}

#[cfg(test)]
mod tests {
    // TUIテストは手動で行う
}
