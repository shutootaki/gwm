//! goコマンドのビュー
//!
//! worktreeへのナビゲーション機能を提供します。
//! パスを標準出力に出力することで、シェル関数と連携します。

use std::io::stderr;
use std::time::Duration;

use crossterm::{
    event::{Event, KeyCode, KeyModifiers},
    terminal::{disable_raw_mode, enable_raw_mode},
};
use ratatui::{backend::CrosstermBackend, Terminal, TerminalOptions, Viewport};

use crate::cli::GoArgs;
use crate::error::Result;
use crate::git::get_worktrees_with_details;
use crate::shell::cwd_file::{try_write_cwd_file, CwdWriteResult};
use crate::ui::event::{is_cancel_key, poll_event};
use crate::ui::widgets::{SelectListWidget, SelectState};
use crate::ui::{SelectItem, SelectItemMetadata, TextInputState};
use crate::utils::open_in_editor;

/// TUI用インライン viewport の高さ
/// 内訳: title(2) + stats(2) + search(2) + items(8) + more_indicator(2) + blank(1) + preview(12) + help(1) + margin(2) = 32
const TUI_GO_INLINE_HEIGHT: u16 = 32;

/// ターミナル復元を保証するガード構造体
struct TerminalGuard;

impl Drop for TerminalGuard {
    fn drop(&mut self) {
        if let Err(e) = disable_raw_mode() {
            eprintln!("\x1b[33m Warning: Failed to restore terminal: {}\x1b[0m", e);
        }
    }
}

/// goコマンドを実行
///
/// # Arguments
/// * `args` - コマンド引数
///
/// # Returns
/// * 成功時: Ok(())
/// * 失敗時: GwmError
pub fn run_go(args: GoArgs) -> Result<()> {
    let worktrees = get_worktrees_with_details()?;

    if worktrees.is_empty() {
        eprintln!("No worktrees found.");
        return Ok(());
    }

    // Worktreeをアイテムに変換（ステータスアイコン付き、プレビュー情報付き）
    let items: Vec<SelectItem> = worktrees
        .iter()
        .map(|wt| SelectItem {
            label: format!("[{}] {}", wt.status.icon(), wt.display_branch()),
            value: wt.path.display().to_string(),
            description: Some(wt.path.display().to_string()),
            metadata: Some(SelectItemMetadata {
                last_commit_date: wt.commit_date.clone().unwrap_or_default(),
                last_committer_name: wt.committer_name.clone().unwrap_or_default(),
                last_commit_message: wt.commit_message.clone().unwrap_or_default(),
                sync_status: wt.sync_status.clone(),
                change_status: wt.change_status.clone(),
            }),
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
    let output_path_only = args.should_output_path_only();
    let selected = run_go_tui(&items, args.query.as_deref(), output_path_only)?;

    if let Some(item) = selected {
        handle_selection(&item, &args)?;
    }

    Ok(())
}

/// 選択されたworktreeを処理
fn handle_selection(item: &SelectItem, args: &GoArgs) -> Result<()> {
    let path = std::path::Path::new(&item.value);

    if let Some(editor) = args.editor() {
        open_in_editor(editor, path)?;
        println!(
            "\x1b[32m✓\x1b[0m Opened {} in {}",
            item.label,
            editor.display_name()
        );
        std::thread::sleep(std::time::Duration::from_millis(500));
    } else {
        // パスを標準出力（シェル統合用）
        match try_write_cwd_file(path) {
            Ok(CwdWriteResult::Written) => {}
            Ok(CwdWriteResult::EnvNotSet) => println!("{}", item.value),
            Err(e) => {
                eprintln!("\x1b[33m Warning: Failed to write cwd file: {}\x1b[0m", e);
                println!("{}", item.value);
            }
        }
    }

    Ok(())
}

/// TUIモードで選択
fn run_go_tui(
    items: &[SelectItem],
    initial_query: Option<&str>,
    output_path_only: bool,
) -> Result<Option<SelectItem>> {
    // ターミナル初期化（インライン表示）
    enable_raw_mode()?;
    let _guard = TerminalGuard;

    // TUIはstderrへ描画する（stdoutはシェル統合用のパス出力に利用する）
    let backend = CrosstermBackend::new(stderr());
    let options = TerminalOptions {
        viewport: Viewport::Inline(TUI_GO_INLINE_HEIGHT),
    };
    let mut terminal = Terminal::with_options(backend, options)?;

    // 状態初期化
    let mut input = match initial_query {
        Some(query) => TextInputState::with_value(query.to_string()),
        None => TextInputState::new(),
    };

    let mut state = SelectState::new(items.to_vec()).with_max_display(8);

    // 初期フィルタリング（クエリがある場合）
    if !input.value.is_empty() {
        state.update_filter(&input.value);
    }

    let result = loop {
        terminal.draw(|frame| {
            let area = frame.area();

            let widget = SelectListWidget::with_state(
                "Go to worktree",
                "Search worktrees...",
                &input,
                &state,
                None,
            );
            frame.render_widget(widget, area);
        })?;

        if let Some(Event::Key(key)) = poll_event(Duration::from_millis(100))? {
            // Ctrl+C / Escでキャンセル
            if is_cancel_key(&key) {
                break None;
            }

            match (key.modifiers, key.code) {
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

                // 全削除（Ctrl+U）
                (KeyModifiers::CONTROL, KeyCode::Char('u')) => {
                    input.clear();
                    state.update_filter(&input.value);
                }

                // 単語削除（Ctrl+W / Alt+Backspace）
                (KeyModifiers::CONTROL, KeyCode::Char('w'))
                | (KeyModifiers::ALT, KeyCode::Backspace) => {
                    input.delete_word_backward();
                    state.update_filter(&input.value);
                }

                // 削除
                (_, KeyCode::Backspace) => {
                    input.delete_backward();
                    state.update_filter(&input.value);
                }
                (_, KeyCode::Delete) => {
                    input.delete_forward();
                    state.update_filter(&input.value);
                }

                // カーソル移動
                (_, KeyCode::Left) | (KeyModifiers::CONTROL, KeyCode::Char('b')) => {
                    input.move_left();
                }
                (_, KeyCode::Right) | (KeyModifiers::CONTROL, KeyCode::Char('f')) => {
                    input.move_right();
                }
                (KeyModifiers::CONTROL, KeyCode::Char('a')) | (_, KeyCode::Home) => {
                    input.move_start();
                }
                (KeyModifiers::CONTROL, KeyCode::Char('e')) | (_, KeyCode::End) => {
                    input.move_end();
                }

                // 文字入力
                (KeyModifiers::NONE | KeyModifiers::SHIFT, KeyCode::Char(c)) => {
                    input.insert(c);
                    state.update_filter(&input.value);
                }
                _ => {}
            }
        }
    };

    // カーソルをインライン領域の外に移動（TerminalGuardがdropされる前に）
    drop(_guard);
    if output_path_only {
        // stdoutを汚さない（シェル統合で1行パス判定を壊さないため）
        eprintln!();
    } else {
        println!();
    }

    Ok(result)
}

#[cfg(test)]
mod tests {
    // TUIテストは手動で行う
}
