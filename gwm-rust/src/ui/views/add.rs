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
use crate::config::{load_config_with_source, ConfigWithSource};
use crate::error::{GwmError, Result};
use crate::git::{
    add_worktree, fetch_and_prune, get_remote_branches_with_info, AddWorktreeOptions,
};
use crate::hooks::{run_post_create_hooks, HookContext};
use crate::trust::{trust_repository, verify_trust, TrustStatus};
use crate::ui::app::{
    App, AppState, ConfirmChoice, ConfirmMetadata, SelectItem, SelectItemMetadata,
};
use crate::ui::event::{
    get_confirm_choice, get_input_value, get_selected_item, get_validation_error, handle_key_event,
    poll_event,
};
use crate::ui::widgets::{
    ConfirmWidget, NoticeWidget, SelectListWidget, SpinnerWidget, TextInputWidget,
};
use crate::utils::{copy_ignored_files, validate_branch_name};

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
    let config_source = load_config_with_source();

    // 直接指定モードの場合はTUIなしで実行
    if let Some(ref branch_name) = args.branch_name {
        return execute_add_direct(&config_source, branch_name.clone(), &args).await;
    }

    // TUIモードで実行
    run_add_tui(config_source, args).await
}

/// 直接指定モードでWorktreeを作成
async fn execute_add_direct(
    config_source: &ConfigWithSource,
    branch: String,
    args: &AddArgs,
) -> Result<()> {
    // CLIからの入力もバリデーション
    if let Some(error) = validate_branch_name(&branch) {
        return Err(GwmError::invalid_argument(error));
    }

    let options = AddWorktreeOptions {
        branch: branch.clone(),
        is_remote: args.remote,
        from_branch: args.from_branch.clone(),
    };

    let result = add_worktree(&config_source.config, &options)?;

    // パス出力モード（シェル統合用）: パスのみ出力して早期リターン
    if args.output_path {
        println!("{}", result.path.display());
        return Ok(());
    }

    // アクションログを出力
    for action in &result.actions {
        println!("\x1b[90m{}\x1b[0m", action);
    }

    println!(
        "\x1b[32m✓\x1b[0m Worktree created at: \x1b[36m{}\x1b[0m",
        result.path.display()
    );

    // .envファイルなどをコピー
    if let Some(ref copy_config) = config_source.config.copy_ignored_files {
        if let Some(ref repo_root) = config_source.repo_root {
            let copy_result = copy_ignored_files(repo_root, &result.path, copy_config)?;
            for file in &copy_result.copied {
                println!("  \x1b[32m✓ Copied: {}\x1b[0m", file);
            }
        }
    }

    // フック実行
    if !args.skip_hooks {
        let trust_status = verify_trust(
            config_source
                .repo_root
                .as_deref()
                .unwrap_or(std::path::Path::new(".")),
            &config_source.config,
            config_source.has_project_hooks,
            config_source.project_config_path.as_deref(),
        );

        match trust_status {
            TrustStatus::Trusted | TrustStatus::GlobalConfig => {
                // 信頼済み、または グローバル設定のみ: 直接実行
                let repo_name = config_source
                    .repo_root
                    .as_ref()
                    .and_then(|p| p.file_name())
                    .map(|n| n.to_string_lossy().to_string())
                    .unwrap_or_else(|| "unknown".to_string());

                let context = HookContext {
                    worktree_path: result.path.clone(),
                    branch_name: branch.clone(),
                    repo_root: config_source.repo_root.clone().unwrap_or_default(),
                    repo_name,
                };

                let hook_result = run_post_create_hooks(&config_source.config, &context)?;
                if !hook_result.success {
                    if let Some(failed_cmd) = &hook_result.failed_command {
                        return Err(GwmError::hook(format!(
                            "Command failed: {} (exit code: {})",
                            failed_cmd,
                            hook_result.exit_code.unwrap_or(1)
                        )));
                    }
                }
            }
            TrustStatus::NoHooks => {
                // フックなし: 何もしない
            }
            TrustStatus::NeedsConfirmation {
                commands, reason, ..
            } => {
                // 確認が必要: CLIモードでは警告を出してスキップ
                println!(
                    "\x1b[33m⚠ Skipping hooks: {} (use TUI mode to confirm)\x1b[0m",
                    reason.description()
                );
                println!("  Commands that would run:");
                for cmd in &commands {
                    println!("    - {}", cmd);
                }
            }
        }
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
async fn run_add_tui(config_source: ConfigWithSource, args: AddArgs) -> Result<()> {
    // ターミナル初期化
    enable_raw_mode()?;
    execute!(stdout(), EnterAlternateScreen)?;

    // ガードを作成（スコープ終了時にターミナルを復元）
    let _guard = TerminalGuard;

    let backend = CrosstermBackend::new(stdout());
    let mut terminal = Terminal::new(backend)?;

    // アプリ状態初期化
    let mut app = App::new(config_source.config.clone());

    // 初期状態を設定
    if args.remote {
        app.set_loading("Fetching remote branches...");
    } else {
        app.set_text_input("Create new worktree", "Enter new branch name:");
    }

    // メインループ実行（ガードによりエラー時もターミナル復元される）
    run_main_loop(&mut terminal, &mut app, &args, &config_source).await
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
    config_source: &ConfigWithSource,
) -> Result<()> {
    // リモートモードの場合、フェッチを実行
    if args.remote {
        let items = fetch_remote_branches_as_items().await?;
        app.set_select_list("Select remote branch", "Search branches...", items);
    }

    // フレームカウント（スピナーアニメーション用）
    let mut frame_count: usize = 0;

    // 作成されたworktreeのパスとブランチ名を保持
    let mut created_worktree: Option<(String, String)> = None;

    loop {
        // 描画
        terminal.draw(|f| {
            let area = centered_rect(80, 90, f.area());
            render_app(f.buffer_mut(), area, app, frame_count);
        })?;

        // 遅延リモートフェッチ処理（Loading画面描画後に実行）
        if app.pending_remote_fetch {
            app.pending_remote_fetch = false;
            let items = fetch_remote_branches_as_items().await?;
            app.set_select_list("Select remote branch", "Search branches...", items);
            continue; // 次のループで新しい状態を描画
        }

        // イベント処理
        if let Some(Event::Key(key)) = poll_event(Duration::from_millis(100))? {
            // 状態固有のキー処理
            match &app.state {
                AppState::TextInput { .. } => {
                    if key.code == KeyCode::Enter {
                        if let Some(branch) = get_input_value(app) {
                            if get_validation_error(app).is_none() {
                                // Worktree作成
                                let result = create_worktree_from_input(app, &branch, args);
                                match result {
                                    Ok((path, branch_name)) => {
                                        created_worktree =
                                            Some((path.clone(), branch_name.clone()));
                                        handle_creation_success(
                                            app,
                                            &path,
                                            &branch_name,
                                            args,
                                            config_source,
                                        );
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
                        // リモートモードに切り替え（遅延フェッチ）
                        // フラグをセットし、次のループでLoading画面を描画してからフェッチ実行
                        app.set_loading("Fetching remote branches...");
                        app.pending_remote_fetch = true;
                    } else {
                        handle_key_event(app, key);
                    }
                }

                AppState::SelectList { .. } => {
                    if key.code == KeyCode::Enter {
                        if let Some(item) = get_selected_item(app) {
                            let branch = item.value.clone();
                            // リモートブランチからWorktree作成
                            let result = create_worktree_from_remote(app, &branch, args);
                            match result {
                                Ok((path, branch_name)) => {
                                    created_worktree = Some((path.clone(), branch_name.clone()));
                                    handle_creation_success(
                                        app,
                                        &path,
                                        &branch_name,
                                        args,
                                        config_source,
                                    );
                                }
                                Err(e) => {
                                    app.set_error("Failed to create worktree", vec![e.to_string()]);
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
                                ConfirmChoice::Trust => {
                                    // 信頼キャッシュに保存してフック実行
                                    if let Some(metadata) = app.get_confirm_metadata().cloned() {
                                        if let Some(ref repo_root) = metadata.repo_root {
                                            let _ = trust_repository(
                                                &repo_root.display().to_string(),
                                                metadata.config_path.clone(),
                                                metadata.config_hash.clone(),
                                                app.config
                                                    .post_create_commands()
                                                    .map(|c| c.to_vec())
                                                    .unwrap_or_default(),
                                            );
                                        }
                                    }
                                    execute_hooks_and_finish(app, &created_worktree, config_source);
                                }
                                ConfirmChoice::Once => {
                                    // 一度だけフック実行
                                    execute_hooks_and_finish(app, &created_worktree, config_source);
                                }
                                ConfirmChoice::Cancel => {
                                    // キャンセル
                                    if let Some((path, _)) = &created_worktree {
                                        app.set_success(
                                            "Worktree created!",
                                            vec![
                                                format!("Path: {}", path),
                                                "Hooks skipped.".to_string(),
                                            ],
                                        );
                                    } else {
                                        app.quit();
                                    }
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

        // 終了チェック
        if app.should_quit {
            break;
        }

        frame_count = frame_count.wrapping_add(1);
    }

    Ok(())
}

/// フックを実行して完了画面を表示
fn execute_hooks_and_finish(
    app: &mut App,
    created_worktree: &Option<(String, String)>,
    config_source: &ConfigWithSource,
) {
    if let Some((path, branch_name)) = created_worktree {
        let repo_name = config_source
            .repo_root
            .as_ref()
            .and_then(|p| p.file_name())
            .map(|n| n.to_string_lossy().to_string())
            .unwrap_or_else(|| "unknown".to_string());

        let context = HookContext {
            worktree_path: std::path::PathBuf::from(path),
            branch_name: branch_name.clone(),
            repo_root: config_source.repo_root.clone().unwrap_or_default(),
            repo_name,
        };

        match run_post_create_hooks(&config_source.config, &context) {
            Ok(result) if result.success => {
                app.set_success(
                    "Worktree created!",
                    vec![
                        format!("Path: {}", path),
                        format!("Hooks completed ({} commands)", result.executed_count),
                    ],
                );
            }
            Ok(result) => {
                let failed_msg = result
                    .failed_command
                    .map(|c| format!("Failed: {}", c))
                    .unwrap_or_else(|| "Unknown error".to_string());
                app.set_error(
                    "Hook execution failed",
                    vec![format!("Path: {}", path), failed_msg],
                );
            }
            Err(e) => {
                app.set_error("Hook execution error", vec![e.to_string()]);
            }
        }
    } else {
        app.set_error(
            "Internal error",
            vec!["No worktree path available".to_string()],
        );
    }
}

/// テキスト入力からWorktreeを作成
/// 戻り値: (worktree_path, branch_name)
fn create_worktree_from_input(app: &App, branch: &str, args: &AddArgs) -> Result<(String, String)> {
    let options = AddWorktreeOptions {
        branch: branch.to_string(),
        is_remote: false,
        from_branch: args.from_branch.clone(),
    };

    let result = add_worktree(&app.config, &options)?;
    Ok((result.path.display().to_string(), branch.to_string()))
}

/// リモートブランチからWorktreeを作成
/// 戻り値: (worktree_path, branch_name)
fn create_worktree_from_remote(
    app: &App,
    branch: &str,
    _args: &AddArgs,
) -> Result<(String, String)> {
    let options = AddWorktreeOptions {
        branch: branch.to_string(),
        is_remote: true,
        from_branch: None,
    };

    let result = add_worktree(&app.config, &options)?;
    Ok((result.path.display().to_string(), branch.to_string()))
}

/// Worktree作成成功時の処理
fn handle_creation_success(
    app: &mut App,
    path: &str,
    branch_name: &str,
    args: &AddArgs,
    config_source: &ConfigWithSource,
) {
    // .envファイルなどをコピー（結果はTUIでは表示しない）
    if let Some(ref copy_config) = config_source.config.copy_ignored_files {
        if let Some(ref repo_root) = config_source.repo_root {
            let _ = copy_ignored_files(repo_root, std::path::Path::new(path), copy_config);
        }
    }

    // skip-hooksの場合は即座に成功
    if args.skip_hooks {
        app.set_success("Worktree created!", vec![format!("Path: {}", path)]);
        return;
    }

    // trust検証
    let trust_status = verify_trust(
        config_source
            .repo_root
            .as_deref()
            .unwrap_or(std::path::Path::new(".")),
        &config_source.config,
        config_source.has_project_hooks,
        config_source.project_config_path.as_deref(),
    );

    match trust_status {
        TrustStatus::Trusted | TrustStatus::GlobalConfig => {
            // 信頼済み: フックを直接実行（後で実行するため、metadata付きで確認画面へ）
            if let Some(commands) = app.config.post_create_commands() {
                if !commands.is_empty() {
                    // 確認なしで実行する場合は、空のmetadataで確認画面を表示し、すぐにOnce相当の処理
                    // ただし、UIの整合性のため、直接実行する
                    let metadata = ConfirmMetadata {
                        repo_root: config_source.repo_root.clone(),
                        config_path: config_source
                            .project_config_path
                            .clone()
                            .unwrap_or_default(),
                        config_hash: String::new(),
                        worktree_path: path.to_string(),
                        branch_name: branch_name.to_string(),
                    };
                    app.set_confirm_with_metadata(
                        "Running post-create hooks",
                        "Trusted project - executing hooks:",
                        commands.to_vec(),
                        metadata,
                    );
                    return;
                }
            }
            app.set_success("Worktree created!", vec![format!("Path: {}", path)]);
        }
        TrustStatus::NoHooks => {
            app.set_success("Worktree created!", vec![format!("Path: {}", path)]);
        }
        TrustStatus::NeedsConfirmation {
            commands,
            reason,
            config_path,
            config_hash,
        } => {
            let metadata = ConfirmMetadata {
                repo_root: config_source.repo_root.clone(),
                config_path,
                config_hash,
                worktree_path: path.to_string(),
                branch_name: branch_name.to_string(),
            };
            app.set_confirm_with_metadata(
                "Run post-create hooks?",
                reason.description(),
                commands,
                metadata,
            );
        }
    }
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
            ..
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
