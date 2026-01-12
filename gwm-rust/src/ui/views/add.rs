//! addコマンドビュー
//!
//! `gwm add` コマンドのエントリーポイントを提供します。
//! - 新規ブランチ入力（テキスト入力UI）
//! - リモートブランチ選択（選択リストUI）
//! - Worktree作成とフック実行

use std::io::{self, stdout};
use std::time::Duration;

use crossterm::event::{Event, KeyCode};
use crossterm::execute;
use crossterm::terminal::{
    disable_raw_mode, enable_raw_mode, EnterAlternateScreen, LeaveAlternateScreen,
};
use ratatui::backend::CrosstermBackend;
use ratatui::layout::{Constraint, Direction, Layout, Rect};
use ratatui::Terminal;

use crate::cli::AddArgs;
use crate::config::{load_config, Config};
use crate::error::{GwmError, Result};
use crate::utils::validate_branch_name;
use crate::git::{
    add_worktree, fetch_and_prune, get_remote_branches_with_info, AddWorktreeOptions,
};
use crate::ui::app::{App, AppState, ConfirmChoice, SelectItem, SelectItemMetadata};
use crate::ui::event::{
    get_confirm_choice, get_input_value, get_selected_item, get_validation_error, handle_key_event,
    poll_event,
};
use crate::ui::widgets::{
    ConfirmWidget, NoticeWidget, SelectListWidget, SpinnerWidget, TextInputWidget,
};

/// ターミナル復元を保証するガード構造体
struct TerminalGuard;

impl Drop for TerminalGuard {
    fn drop(&mut self) {
        // パニック時でもターミナルを復元
        let _ = disable_raw_mode();
        let _ = execute!(stdout(), LeaveAlternateScreen);
    }
}

/// addコマンドを実行
///
/// 引数によって以下の3つのモードで動作します：
/// 1. 直接指定モード: `gwm add branch-name`
/// 2. リモート選択モード: `gwm add -r`
/// 3. 新規ブランチ入力モード: `gwm add`
pub async fn run_add(args: AddArgs) -> Result<()> {
    let config = load_config();

    // 直接指定モードの場合はTUIなしで実行
    if let Some(ref branch_name) = args.branch_name {
        return execute_add_direct(&config, branch_name.clone(), &args).await;
    }

    // TUIモードで実行
    run_add_tui(config, args).await
}

/// 直接指定モードでWorktreeを作成
async fn execute_add_direct(config: &Config, branch: String, args: &AddArgs) -> Result<()> {
    // CLIからの入力もバリデーション
    if let Some(error) = validate_branch_name(&branch) {
        return Err(GwmError::invalid_argument(error));
    }

    let options = AddWorktreeOptions {
        branch,
        is_remote: args.remote,
        from_branch: args.from_branch.clone(),
    };

    let result = add_worktree(config, &options)?;

    // アクションログを出力
    for action in &result.actions {
        println!("\x1b[90m{}\x1b[0m", action);
    }

    println!(
        "\x1b[32m✓\x1b[0m Worktree created at: \x1b[36m{}\x1b[0m",
        result.path.display()
    );

    // フック実行（TODO: Phase 4で実装）
    if !args.skip_hooks {
        // post_create hooks を実行
    }

    // エディタで開く
    if args.open_code {
        open_in_editor("code", &result.path.display().to_string())?;
    } else if args.open_cursor {
        open_in_editor("cursor", &result.path.display().to_string())?;
    }

    // パス出力（シェル統合用）
    if args.output_path {
        println!("{}", result.path.display());
    }

    Ok(())
}

/// エディタで開く
fn open_in_editor(editor: &str, path: &str) -> Result<()> {
    use crate::shell::exec;
    exec(editor, &[path], None)?;
    Ok(())
}

/// TUIモードでaddコマンドを実行
async fn run_add_tui(config: Config, args: AddArgs) -> Result<()> {
    // ターミナル初期化
    enable_raw_mode()?;
    execute!(stdout(), EnterAlternateScreen)?;

    // ガードを作成（スコープ終了時にターミナルを復元）
    let _guard = TerminalGuard;

    let backend = CrosstermBackend::new(stdout());
    let mut terminal = Terminal::new(backend)?;

    // アプリ状態初期化
    let mut app = App::new(config.clone());

    // 初期状態を設定
    if args.remote {
        app.set_loading("Fetching remote branches...");
    } else {
        app.set_text_input("Create new worktree", "Enter new branch name:");
    }

    // メインループ実行（ガードによりエラー時もターミナル復元される）
    run_main_loop(&mut terminal, &mut app, &args).await
}

/// リモートブランチを取得してSelectItemに変換
async fn fetch_remote_branches_as_items() -> Result<Vec<SelectItem>> {
    fetch_and_prune().await?;
    let branches = get_remote_branches_with_info().await?;

    Ok(branches
        .into_iter()
        .map(|b| SelectItem {
            label: b.name.clone(),
            value: b.name.clone(),
            description: Some(b.last_commit_message.clone()),
            metadata: Some(SelectItemMetadata {
                last_commit_date: b.last_commit_date,
                last_committer_name: b.last_committer_name,
                last_commit_message: b.last_commit_message,
            }),
        })
        .collect())
}

/// メインループ
async fn run_main_loop(
    terminal: &mut Terminal<CrosstermBackend<io::Stdout>>,
    app: &mut App,
    args: &AddArgs,
) -> Result<()> {
    // リモートモードの場合、フェッチを実行
    if args.remote {
        let items = fetch_remote_branches_as_items().await?;
        app.set_select_list("Select remote branch", "Search branches...", items);
    }

    // フレームカウント（スピナーアニメーション用）
    let mut frame_count: usize = 0;

    loop {
        // 描画
        terminal.draw(|f| {
            let area = centered_rect(80, 90, f.area());
            render_app(f.buffer_mut(), area, app, frame_count);
        })?;

        // イベント処理
        if let Some(event) = poll_event(Duration::from_millis(100))? {
            if let Event::Key(key) = event {
                // 状態固有のキー処理
                match &app.state {
                    AppState::TextInput { .. } => {
                        if key.code == KeyCode::Enter {
                            if let Some(branch) = get_input_value(app) {
                                if get_validation_error(app).is_none() {
                                    // Worktree作成
                                    let result = create_worktree_from_input(app, &branch, args);
                                    match result {
                                        Ok(path) => {
                                            handle_creation_success(app, &path, args);
                                        }
                                        Err(e) => {
                                            app.set_error(
                                                "Failed to create worktree",
                                                vec![e.to_string()],
                                            );
                                        }
                                    }
                                }
                            }
                        } else if key.code == KeyCode::Tab && !args.remote {
                            // リモートモードに切り替え
                            app.set_loading("Fetching remote branches...");
                            let items = fetch_remote_branches_as_items().await?;
                            app.set_select_list("Select remote branch", "Search branches...", items);
                        } else {
                            handle_key_event(app, key);
                        }
                    }

                    AppState::SelectList { .. } => {
                        if key.code == KeyCode::Enter {
                            if let Some(item) = get_selected_item(app) {
                                let branch = item.value.clone();
                                // リモートブランチからWorktree作成
                                let result =
                                    create_worktree_from_remote(app, &branch, args);
                                match result {
                                    Ok(path) => {
                                        handle_creation_success(app, &path, args);
                                    }
                                    Err(e) => {
                                        app.set_error(
                                            "Failed to create worktree",
                                            vec![e.to_string()],
                                        );
                                    }
                                }
                            }
                        } else {
                            handle_key_event(app, key);
                        }
                    }

                    AppState::Confirm { .. } => {
                        if key.code == KeyCode::Enter {
                            if let Some(choice) = get_confirm_choice(app) {
                                match choice {
                                    ConfirmChoice::Trust | ConfirmChoice::Once => {
                                        // フック実行（TODO）
                                        app.set_success(
                                            "Hooks executed",
                                            vec!["Post-create hooks completed.".to_string()],
                                        );
                                    }
                                    ConfirmChoice::Cancel => {
                                        app.quit();
                                    }
                                }
                            }
                        } else {
                            handle_key_event(app, key);
                        }
                    }

                    _ => {
                        handle_key_event(app, key);
                    }
                }
            }
        }

        // 終了チェック
        if app.should_quit {
            break;
        }

        frame_count = frame_count.wrapping_add(1);
    }

    Ok(())
}

/// テキスト入力からWorktreeを作成
fn create_worktree_from_input(
    app: &App,
    branch: &str,
    args: &AddArgs,
) -> Result<String> {
    let options = AddWorktreeOptions {
        branch: branch.to_string(),
        is_remote: false,
        from_branch: args.from_branch.clone(),
    };

    let result = add_worktree(&app.config, &options)?;
    Ok(result.path.display().to_string())
}

/// リモートブランチからWorktreeを作成
fn create_worktree_from_remote(
    app: &App,
    branch: &str,
    _args: &AddArgs,
) -> Result<String> {
    let options = AddWorktreeOptions {
        branch: branch.to_string(),
        is_remote: true,
        from_branch: None,
    };

    let result = add_worktree(&app.config, &options)?;
    Ok(result.path.display().to_string())
}

/// Worktree作成成功時の処理
fn handle_creation_success(app: &mut App, path: &str, args: &AddArgs) {
    // フック確認（skip-hooksでない場合）
    if let Some(commands) = app.config.post_create_commands() {
        if !args.skip_hooks && !commands.is_empty() {
            app.set_confirm(
                "Run post-create hooks?",
                "The following commands will be executed:",
                commands.to_vec(),
            );
            return;
        }
    }

    app.set_success(
        "Worktree created!",
        vec![format!("Path: {}", path)],
    );
}

/// 中央揃えの矩形を計算
fn centered_rect(percent_x: u16, percent_y: u16, r: Rect) -> Rect {
    let popup_layout = Layout::default()
        .direction(Direction::Vertical)
        .constraints([
            Constraint::Percentage((100 - percent_y) / 2),
            Constraint::Percentage(percent_y),
            Constraint::Percentage((100 - percent_y) / 2),
        ])
        .split(r);

    Layout::default()
        .direction(Direction::Horizontal)
        .constraints([
            Constraint::Percentage((100 - percent_x) / 2),
            Constraint::Percentage(percent_x),
            Constraint::Percentage((100 - percent_x) / 2),
        ])
        .split(popup_layout[1])[1]
}

/// アプリケーション状態を描画
fn render_app(buf: &mut ratatui::buffer::Buffer, area: Rect, app: &App, frame_count: usize) {
    use ratatui::widgets::Widget;

    match &app.state {
        AppState::Loading { message } => {
            let widget = SpinnerWidget::new(message, frame_count);
            widget.render(area, buf);
        }

        AppState::Success { title, messages } => {
            let widget = NoticeWidget::success(title, messages);
            widget.render(area, buf);
        }

        AppState::Error { title, messages } => {
            let widget = NoticeWidget::error(title, messages);
            widget.render(area, buf);
        }

        AppState::TextInput {
            title,
            placeholder,
            input,
            validation_error,
            preview,
        } => {
            let widget = TextInputWidget::new(title, placeholder, input)
                .validation_error(validation_error.as_deref())
                .preview(preview.as_deref())
                .show_mode_switch(true);
            widget.render(area, buf);
        }

        AppState::SelectList {
            title,
            placeholder,
            input,
            items,
            filtered_indices,
            selected_index,
            scroll_offset,
            max_display,
        } => {
            let widget = SelectListWidget::new(
                title,
                placeholder,
                input,
                items,
                filtered_indices,
                *selected_index,
                *scroll_offset,
                *max_display,
            );
            widget.render(area, buf);
        }

        AppState::Confirm {
            title,
            message,
            commands,
            selected,
        } => {
            let widget = ConfirmWidget::new(title, message, commands, *selected);
            widget.render(area, buf);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_centered_rect() {
        let full = Rect::new(0, 0, 100, 50);
        let centered = centered_rect(80, 80, full);

        // 80%の矩形が中央に配置される
        assert!(centered.x > 0);
        assert!(centered.y > 0);
        assert!(centered.width < 100);
        assert!(centered.height < 50);
    }
}
