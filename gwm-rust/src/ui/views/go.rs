//! goコマンドのビュー
//!
//! worktreeへのナビゲーション機能を提供します。
//! パスを標準出力に出力することで、シェル関数と連携します。

use std::io::stdout;
use std::time::Duration;

use crossterm::{
    event::{Event, KeyCode, KeyModifiers},
    execute,
    terminal::{disable_raw_mode, enable_raw_mode, EnterAlternateScreen, LeaveAlternateScreen},
};
use ratatui::{backend::CrosstermBackend, Terminal};

use crate::cli::GoArgs;
use crate::error::Result;
use crate::git::get_worktrees;
use crate::ui::event::poll_event;
use crate::ui::widgets::SelectListWidget;
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

    // Worktreeをアイテムに変換
    let items: Vec<SelectItem> = worktrees
        .iter()
        .map(|wt| SelectItem {
            label: wt.display_branch().to_string(),
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
        std::thread::sleep(std::time::Duration::from_millis(500));
    } else {
        // パスを標準出力（シェル統合用）
        println!("{}", item.value);
    }

    Ok(())
}

/// TUIモードで選択
fn run_go_tui(items: &[SelectItem], initial_query: Option<&str>) -> Result<Option<SelectItem>> {
    // ターミナル初期化
    enable_raw_mode()?;
    let mut stdout = stdout();
    execute!(stdout, EnterAlternateScreen)?;
    let backend = CrosstermBackend::new(stdout);
    let mut terminal = Terminal::new(backend)?;

    // 状態初期化
    let mut input = match initial_query {
        Some(query) => TextInputState::with_value(query.to_string()),
        None => TextInputState::new(),
    };

    let mut filtered_indices: Vec<usize> = (0..items.len()).collect();
    let mut selected_index = 0;
    let mut scroll_offset = 0;
    let max_display = 10;

    // 初期フィルタリング（クエリがある場合）
    if !input.value.is_empty() {
        update_filter(
            &input,
            items,
            &mut filtered_indices,
            &mut selected_index,
            &mut scroll_offset,
        );
    }

    let result = loop {
        terminal.draw(|frame| {
            let widget = SelectListWidget::new(
                "Go to worktree",
                "Search worktrees...",
                &input,
                items,
                &filtered_indices,
                selected_index,
                scroll_offset,
                max_display,
            );
            frame.render_widget(widget, frame.area());
        })?;

        if let Some(Event::Key(key)) = poll_event(Duration::from_millis(100))? {
            match (key.modifiers, key.code) {
                (_, KeyCode::Esc) => break None,
                (_, KeyCode::Enter) => {
                    if !filtered_indices.is_empty() {
                        let idx = filtered_indices[selected_index];
                        break Some(items[idx].clone());
                    }
                }
                (_, KeyCode::Up) | (KeyModifiers::CONTROL, KeyCode::Char('p')) => {
                    if selected_index > 0 {
                        selected_index -= 1;
                        if selected_index < scroll_offset {
                            scroll_offset = selected_index;
                        }
                    }
                }
                (_, KeyCode::Down) | (KeyModifiers::CONTROL, KeyCode::Char('n')) => {
                    if selected_index + 1 < filtered_indices.len() {
                        selected_index += 1;
                        if selected_index >= scroll_offset + max_display {
                            scroll_offset = selected_index - max_display + 1;
                        }
                    }
                }
                (_, KeyCode::Backspace) => {
                    input.delete_backward();
                    update_filter(
                        &input,
                        items,
                        &mut filtered_indices,
                        &mut selected_index,
                        &mut scroll_offset,
                    );
                }
                (KeyModifiers::CONTROL, KeyCode::Char('u')) => {
                    input.clear();
                    update_filter(
                        &input,
                        items,
                        &mut filtered_indices,
                        &mut selected_index,
                        &mut scroll_offset,
                    );
                }
                (KeyModifiers::NONE | KeyModifiers::SHIFT, KeyCode::Char(c)) => {
                    input.insert(c);
                    update_filter(
                        &input,
                        items,
                        &mut filtered_indices,
                        &mut selected_index,
                        &mut scroll_offset,
                    );
                }
                _ => {}
            }
        }
    };

    // ターミナル復元
    disable_raw_mode()?;
    execute!(terminal.backend_mut(), LeaveAlternateScreen)?;

    Ok(result)
}

/// フィルタリングを更新
fn update_filter(
    input: &TextInputState,
    items: &[SelectItem],
    filtered_indices: &mut Vec<usize>,
    selected_index: &mut usize,
    scroll_offset: &mut usize,
) {
    let query = input.value.to_lowercase();
    *filtered_indices = items
        .iter()
        .enumerate()
        .filter(|(_, item)| item.label.to_lowercase().contains(&query))
        .map(|(i, _)| i)
        .collect();

    if *selected_index >= filtered_indices.len() {
        *selected_index = filtered_indices.len().saturating_sub(1);
    }
    if *scroll_offset > *selected_index {
        *scroll_offset = *selected_index;
    }
}

#[cfg(test)]
mod tests {
    // TUIテストは手動で行う
}
