//! イベントハンドリング
//!
//! キーボード入力などのイベント処理を提供します。

use std::time::Duration;

use crossterm::event::{self, Event, KeyCode, KeyEvent, KeyModifiers};

use crate::error::Result;
use crate::utils::{generate_worktree_preview, validate_branch_name};

use super::app::{App, AppState, ConfirmChoice};

/// イベントをポーリング
///
/// 指定されたタイムアウト内でイベントがあれば返します。
pub fn poll_event(timeout: Duration) -> Result<Option<Event>> {
    if event::poll(timeout)? {
        Ok(Some(event::read()?))
    } else {
        Ok(None)
    }
}

/// キーイベントを処理
///
/// 現在の画面状態に応じて適切なハンドラを呼び出します。
pub fn handle_key_event(app: &mut App, key: KeyEvent) {
    match &app.state {
        AppState::Loading { .. } => {
            // ローディング中はキー入力を無視
        }

        AppState::Success { .. } | AppState::Error { .. } => {
            // 任意のキーで終了
            app.quit();
        }

        AppState::TextInput { .. } => {
            handle_text_input_key(app, key);
        }

        AppState::SelectList { .. } => {
            handle_select_list_key(app, key);
        }

        AppState::Confirm { .. } => {
            handle_confirm_key(app, key);
        }
    }
}

/// テキスト入力のキーハンドリング
fn handle_text_input_key(app: &mut App, key: KeyEvent) {
    // Escapeキーは常にキャンセル
    if key.code == KeyCode::Esc {
        app.quit();
        return;
    }

    // Enterキーは状態によって処理が異なるため、呼び出し元で処理
    if key.code == KeyCode::Enter {
        return;
    }

    // Tabキーはモード切替のため、呼び出し元で処理
    if key.code == KeyCode::Tab {
        return;
    }

    if let AppState::TextInput { input, .. } = &mut app.state {
        match (key.modifiers, key.code) {
            // 全削除（Ctrl+U / Cmd+Backspace）
            (KeyModifiers::CONTROL, KeyCode::Char('u')) => {
                input.clear();
            }

            // 単語削除（Ctrl+W / Alt+Backspace）
            (KeyModifiers::CONTROL, KeyCode::Char('w'))
            | (KeyModifiers::ALT, KeyCode::Backspace) => {
                input.delete_word_backward();
            }

            // 削除
            (_, KeyCode::Backspace) => {
                input.delete_backward();
            }
            (_, KeyCode::Delete) => {
                input.delete_forward();
            }

            // カーソル移動
            (_, KeyCode::Left) => {
                input.move_left();
            }
            (_, KeyCode::Right) => {
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
            }

            _ => {}
        }
    }

    // バリデーションとプレビュー更新
    update_text_input_validation(app);
}

/// テキスト入力のバリデーションとプレビューを更新
pub fn update_text_input_validation(app: &mut App) {
    if let AppState::TextInput {
        input,
        validation_error,
        preview,
        ..
    } = &mut app.state
    {
        let value = input.value.trim();

        // バリデーション
        *validation_error = validate_branch_name(value);

        // プレビュー生成
        *preview = if value.is_empty() || validation_error.is_some() {
            None
        } else {
            generate_worktree_preview(value, &app.config)
        };
    }
}

/// 選択リストのキーハンドリング
fn handle_select_list_key(app: &mut App, key: KeyEvent) {
    // Escapeキーは常にキャンセル
    if key.code == KeyCode::Esc {
        app.quit();
        return;
    }

    // Enterキーは選択確定のため、呼び出し元で処理
    if key.code == KeyCode::Enter {
        return;
    }

    if let AppState::SelectList {
        input,
        filtered_indices,
        selected_index,
        scroll_offset,
        max_display,
        ..
    } = &mut app.state
    {
        match (key.modifiers, key.code) {
            // 上移動
            (_, KeyCode::Up) | (KeyModifiers::CONTROL, KeyCode::Char('p')) => {
                if *selected_index > 0 {
                    *selected_index -= 1;
                    // スクロール調整
                    if *selected_index < *scroll_offset {
                        *scroll_offset = *selected_index;
                    }
                }
            }

            // 下移動
            (_, KeyCode::Down) | (KeyModifiers::CONTROL, KeyCode::Char('n')) => {
                if *selected_index + 1 < filtered_indices.len() {
                    *selected_index += 1;
                    // スクロール調整
                    if *selected_index >= *scroll_offset + *max_display {
                        *scroll_offset = *selected_index - *max_display + 1;
                    }
                }
            }

            // 削除
            (_, KeyCode::Backspace) => {
                input.delete_backward();
            }

            // 文字入力
            (KeyModifiers::NONE | KeyModifiers::SHIFT, KeyCode::Char(c)) => {
                input.insert(c);
            }

            _ => {}
        }
    }

    // フィルタリング更新
    update_filtered_items(app);
}

/// 選択リストのフィルタリングを更新
pub fn update_filtered_items(app: &mut App) {
    if let AppState::SelectList {
        input,
        items,
        filtered_indices,
        selected_index,
        scroll_offset,
        ..
    } = &mut app.state
    {
        let query = input.value.to_lowercase();

        *filtered_indices = items
            .iter()
            .enumerate()
            .filter(|(_, item)| item.label.to_lowercase().contains(&query))
            .map(|(i, _)| i)
            .collect();

        // 選択インデックスを範囲内に調整
        if *selected_index >= filtered_indices.len() {
            *selected_index = filtered_indices.len().saturating_sub(1);
        }

        // スクロールオフセットを調整
        if *scroll_offset > *selected_index {
            *scroll_offset = *selected_index;
        }
    }
}

/// 確認ダイアログのキーハンドリング
fn handle_confirm_key(app: &mut App, key: KeyEvent) {
    if let AppState::Confirm { selected, .. } = &mut app.state {
        match key.code {
            KeyCode::Esc => {
                *selected = ConfirmChoice::Cancel;
                // Enterで確定されるまで待つ
            }
            KeyCode::Enter => {
                // 選択確定は呼び出し元で処理
            }
            KeyCode::Left | KeyCode::Up => {
                *selected = selected.prev();
            }
            KeyCode::Right | KeyCode::Down | KeyCode::Tab => {
                *selected = selected.next();
            }
            KeyCode::Char('t') | KeyCode::Char('T') => {
                *selected = ConfirmChoice::Trust;
            }
            KeyCode::Char('o') | KeyCode::Char('O') => {
                *selected = ConfirmChoice::Once;
            }
            KeyCode::Char('c') | KeyCode::Char('C') => {
                *selected = ConfirmChoice::Cancel;
            }
            _ => {}
        }
    }
}

/// 選択リストから現在選択されているアイテムを取得
pub fn get_selected_item(app: &App) -> Option<&super::app::SelectItem> {
    if let AppState::SelectList {
        items,
        filtered_indices,
        selected_index,
        ..
    } = &app.state
    {
        if !filtered_indices.is_empty() {
            let idx = filtered_indices[*selected_index];
            return Some(&items[idx]);
        }
    }
    None
}

/// テキスト入力から現在の値を取得
pub fn get_input_value(app: &App) -> Option<String> {
    if let AppState::TextInput { input, .. } = &app.state {
        let value = input.value.trim().to_string();
        if !value.is_empty() {
            return Some(value);
        }
    }
    None
}

/// テキスト入力のバリデーションエラーを取得
pub fn get_validation_error(app: &App) -> Option<&str> {
    if let AppState::TextInput {
        validation_error, ..
    } = &app.state
    {
        return validation_error.as_deref();
    }
    None
}

/// 確認ダイアログの選択を取得
pub fn get_confirm_choice(app: &App) -> Option<ConfirmChoice> {
    if let AppState::Confirm { selected, .. } = &app.state {
        return Some(*selected);
    }
    None
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::config::Config;
    use crate::ui::app::SelectItem;

    fn create_test_app() -> App {
        App::new(Config::default())
    }

    #[test]
    fn test_handle_text_input_escape() {
        let mut app = create_test_app();
        app.set_text_input("Test", "Enter text...");

        let key = KeyEvent::new(KeyCode::Esc, KeyModifiers::NONE);
        handle_key_event(&mut app, key);

        assert!(app.should_quit);
    }

    #[test]
    fn test_handle_text_input_character() {
        let mut app = create_test_app();
        app.set_text_input("Test", "Enter text...");

        let key = KeyEvent::new(KeyCode::Char('a'), KeyModifiers::NONE);
        handle_key_event(&mut app, key);

        if let AppState::TextInput { input, .. } = &app.state {
            assert_eq!(input.value, "a");
        } else {
            panic!("Expected TextInput state");
        }
    }

    #[test]
    fn test_handle_select_list_navigation() {
        let mut app = create_test_app();
        let items = vec![
            SelectItem {
                label: "Item 1".to_string(),
                value: "item1".to_string(),
                description: None,
                metadata: None,
            },
            SelectItem {
                label: "Item 2".to_string(),
                value: "item2".to_string(),
                description: None,
                metadata: None,
            },
        ];
        app.set_select_list("Test", "Search...", items);

        // 下に移動
        let key = KeyEvent::new(KeyCode::Down, KeyModifiers::NONE);
        handle_key_event(&mut app, key);

        if let AppState::SelectList { selected_index, .. } = &app.state {
            assert_eq!(*selected_index, 1);
        } else {
            panic!("Expected SelectList state");
        }
    }
}
