//! `gwm add` コマンドのエントリーポイント

use std::io::{self, stdout};
use std::time::Duration;

use crossterm::event::{Event, KeyCode};
use crossterm::terminal::{disable_raw_mode, enable_raw_mode};
use ratatui::backend::CrosstermBackend;
use ratatui::layout::Rect;
use ratatui::{Terminal, TerminalOptions, Viewport};

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
    is_cancel_key, poll_event,
};
use crate::ui::widgets::{
    ConfirmWidget, NoticeWidget, SelectListWidget, SpinnerWidget, TextInputWidget,
};
use crate::utils::editor::{open_in_editor, EditorType};
use crate::utils::{copy_ignored_files, validate_branch_name};

struct TerminalGuard;

impl Drop for TerminalGuard {
    fn drop(&mut self) {
        let _ = disable_raw_mode();
    }
}

/// addコマンドを実行
pub async fn run_add(args: AddArgs) -> Result<()> {
    let config_source = load_config_with_source();

    if let Some(ref branch_name) = args.branch_name {
        return execute_add_direct(&config_source, branch_name.clone(), &args).await;
    }

    run_add_tui(config_source, args).await
}

async fn execute_add_direct(
    config_source: &ConfigWithSource,
    branch: String,
    args: &AddArgs,
) -> Result<()> {
    if let Some(error) = validate_branch_name(&branch) {
        return Err(GwmError::invalid_argument(error));
    }

    let options = AddWorktreeOptions {
        branch: branch.clone(),
        is_remote: args.remote,
        from_branch: args.from_branch.clone(),
    };

    let result = add_worktree(&config_source.config, &options)?;

    if args.output_path {
        println!("{}", result.path.display());
        return Ok(());
    }

    for action in &result.actions {
        println!("\x1b[90m{}\x1b[0m", action);
    }

    println!(
        "\x1b[32m✓\x1b[0m Worktree created at: \x1b[36m{}\x1b[0m",
        result.path.display()
    );

    if let Some(ref copy_config) = config_source.config.copy_ignored_files {
        if let Some(ref repo_root) = config_source.repo_root {
            let copy_result = copy_ignored_files(repo_root, &result.path, copy_config)?;
            for file in &copy_result.copied {
                println!("  \x1b[32m✓ Copied: {}\x1b[0m", file);
            }
        }
    }

    if !args.skip_hooks {
        execute_hooks_direct(config_source, &branch, &result.path)?;
    }

    if args.open_code {
        open_in_editor(EditorType::VsCode, &result.path)?;
    } else if args.open_cursor {
        open_in_editor(EditorType::Cursor, &result.path)?;
    }

    Ok(())
}

fn execute_hooks_direct(
    config_source: &ConfigWithSource,
    branch: &str,
    worktree_path: &std::path::Path,
) -> Result<()> {
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
            let repo_name = config_source
                .repo_root
                .as_ref()
                .and_then(|p| p.file_name())
                .map(|n| n.to_string_lossy().to_string())
                .unwrap_or_else(|| "unknown".to_string());

            let context = HookContext {
                worktree_path: worktree_path.to_path_buf(),
                branch_name: branch.to_string(),
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
        TrustStatus::NoHooks => {}
        TrustStatus::NeedsConfirmation {
            commands, reason, ..
        } => {
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

    Ok(())
}

async fn run_add_tui(config_source: ConfigWithSource, args: AddArgs) -> Result<()> {
    enable_raw_mode()?;
    let _guard = TerminalGuard;

    let backend = CrosstermBackend::new(stdout());
    let options = TerminalOptions {
        viewport: Viewport::Inline(23), // プレビュー表示のため高さを増加
    };
    let mut terminal = Terminal::with_options(backend, options)?;
    let mut app = App::new(config_source.config.clone());

    if args.remote {
        app.set_loading("Fetching remote branches...");
    } else {
        app.set_text_input("Create new worktree", "Enter new branch name:");
    }

    let result = run_main_loop(&mut terminal, &mut app, &args, &config_source).await;

    // カーソルをインライン領域の外に移動（キャンセル時や正常終了時に必要）
    // execute_hooks_and_finish経由で終了した場合は既にprintln!()が呼ばれているが、
    // それ以外のパス（キャンセル、エラー表示後のEsc等）では必要
    drop(_guard);
    println!();

    result
}

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

async fn run_main_loop(
    terminal: &mut Terminal<CrosstermBackend<io::Stdout>>,
    app: &mut App,
    args: &AddArgs,
    config_source: &ConfigWithSource,
) -> Result<()> {
    // リモートブランチフェッチ（中断可能）
    if args.remote {
        let fetch_future = fetch_remote_branches_as_items();
        tokio::pin!(fetch_future);

        let mut frame_count: usize = 0;

        loop {
            terminal.draw(|f| {
                let area = f.area();
                render_app(f.buffer_mut(), area, app, frame_count);
            })?;

            tokio::select! {
                result = &mut fetch_future => {
                    let items = result?;
                    app.set_select_list("Select remote branch", "Search branches...", items);
                    break;
                }
                _ = tokio::time::sleep(Duration::from_millis(100)) => {
                    // イベントポーリング（ノンブロッキング）
                    if let Ok(Some(Event::Key(key))) = poll_event(Duration::from_millis(0)) {
                        if is_cancel_key(&key) {
                            app.quit();
                            return Ok(());
                        }
                    }
                    frame_count = frame_count.wrapping_add(1);
                }
            }
        }
    }

    let mut frame_count: usize = 0;
    let mut created_worktree: Option<(String, String)> = None;

    loop {
        terminal.draw(|f| {
            let area = f.area();
            render_app(f.buffer_mut(), area, app, frame_count);
        })?;

        // pending_remote_fetch処理（中断可能）
        if app.pending_remote_fetch {
            app.pending_remote_fetch = false;

            let fetch_future = fetch_remote_branches_as_items();
            tokio::pin!(fetch_future);

            loop {
                terminal.draw(|f| {
                    let area = f.area();
                    render_app(f.buffer_mut(), area, app, frame_count);
                })?;

                tokio::select! {
                    result = &mut fetch_future => {
                        match result {
                            Ok(items) => {
                                app.set_select_list("Select remote branch", "Search branches...", items);
                            }
                            Err(e) => {
                                app.set_error("Failed to fetch remote branches", vec![e.to_string()]);
                            }
                        }
                        break;
                    }
                    _ = tokio::time::sleep(Duration::from_millis(100)) => {
                        // イベントポーリング（ノンブロッキング）
                        if let Ok(Some(Event::Key(key))) = poll_event(Duration::from_millis(0)) {
                            if is_cancel_key(&key) {
                                app.quit();
                                break;
                            }
                        }
                        frame_count = frame_count.wrapping_add(1);
                    }
                }
            }

            if app.should_quit {
                break;
            }
            continue;
        }

        if let Some(Event::Key(key)) = poll_event(Duration::from_millis(100))? {
            match &app.state {
                AppState::TextInput { .. } => {
                    if key.code == KeyCode::Enter {
                        if let Some(branch) = get_input_value(app) {
                            if get_validation_error(app).is_none() {
                                let result = create_worktree_from_input(app, &branch, args);
                                match result {
                                    Ok((path, branch_name)) => {
                                        created_worktree =
                                            Some((path.clone(), branch_name.clone()));
                                        let should_execute_hooks = handle_creation_success(
                                            app,
                                            &path,
                                            &branch_name,
                                            args,
                                            config_source,
                                        );
                                        if should_execute_hooks {
                                            execute_hooks_and_finish(
                                                app,
                                                &created_worktree,
                                                config_source,
                                                args,
                                            );
                                        }
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
                            let result = create_worktree_from_remote(app, &branch);
                            match result {
                                Ok((path, branch_name)) => {
                                    created_worktree = Some((path.clone(), branch_name.clone()));
                                    let should_execute_hooks = handle_creation_success(
                                        app,
                                        &path,
                                        &branch_name,
                                        args,
                                        config_source,
                                    );
                                    if should_execute_hooks {
                                        execute_hooks_and_finish(
                                            app,
                                            &created_worktree,
                                            config_source,
                                            args,
                                        );
                                    }
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
                                    execute_hooks_and_finish(
                                        app,
                                        &created_worktree,
                                        config_source,
                                        args,
                                    );
                                }
                                ConfirmChoice::Once => {
                                    execute_hooks_and_finish(
                                        app,
                                        &created_worktree,
                                        config_source,
                                        args,
                                    );
                                }
                                ConfirmChoice::Cancel => {
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

        if app.should_quit {
            break;
        }

        frame_count = frame_count.wrapping_add(1);
    }

    Ok(())
}

fn execute_hooks_and_finish(
    app: &mut App,
    created_worktree: &Option<(String, String)>,
    config_source: &ConfigWithSource,
    args: &AddArgs,
) {
    if let Some((path, branch_name)) = created_worktree {
        // フック実行前にrawモードを無効化してTUIを停止
        let _ = disable_raw_mode();

        // 改行を出力してTUI描画領域から抜ける
        println!();

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
                println!("\n\x1b[32m✓ Worktree created!\x1b[0m");
                println!("  Path: {}", path);
                println!("  Hooks completed ({} commands)", result.executed_count);
            }
            Ok(result) => {
                let failed_msg = result
                    .failed_command
                    .map(|c| format!("Failed: {}", c))
                    .unwrap_or_else(|| "Unknown error".to_string());
                println!("\n\x1b[31m✗ Hook execution failed\x1b[0m");
                println!("  Path: {}", path);
                println!("  {}", failed_msg);
            }
            Err(e) => {
                println!("\n\x1b[31m✗ Hook execution error\x1b[0m");
                println!("  {}", e);
            }
        }

        // エディタ起動
        if args.open_code {
            let _ = open_in_editor(EditorType::VsCode, &context.worktree_path);
        } else if args.open_cursor {
            let _ = open_in_editor(EditorType::Cursor, &context.worktree_path);
        }

        // プログラムを終了（TUIには戻らない）
        app.quit();
    } else {
        app.set_error(
            "Internal error",
            vec!["No worktree path available".to_string()],
        );
    }
}

fn create_worktree_from_input(app: &App, branch: &str, args: &AddArgs) -> Result<(String, String)> {
    let options = AddWorktreeOptions {
        branch: branch.to_string(),
        is_remote: false,
        from_branch: args.from_branch.clone(),
    };

    let result = add_worktree(&app.config, &options)?;
    Ok((result.path.display().to_string(), branch.to_string()))
}

fn create_worktree_from_remote(app: &App, branch: &str) -> Result<(String, String)> {
    let options = AddWorktreeOptions {
        branch: branch.to_string(),
        is_remote: true,
        from_branch: None,
    };

    let result = add_worktree(&app.config, &options)?;
    Ok((result.path.display().to_string(), branch.to_string()))
}

/// worktree作成成功時の処理
/// 戻り値: true = 直接フック実行すべき, false = 確認ダイアログ表示または成功表示済み
fn handle_creation_success(
    app: &mut App,
    path: &str,
    branch_name: &str,
    args: &AddArgs,
    config_source: &ConfigWithSource,
) -> bool {
    if let Some(ref copy_config) = config_source.config.copy_ignored_files {
        if let Some(ref repo_root) = config_source.repo_root {
            let _ = copy_ignored_files(repo_root, std::path::Path::new(path), copy_config);
        }
    }

    if args.skip_hooks {
        // エディタ起動
        if args.open_code {
            let _ = open_in_editor(EditorType::VsCode, std::path::Path::new(path));
        } else if args.open_cursor {
            let _ = open_in_editor(EditorType::Cursor, std::path::Path::new(path));
        }
        app.set_success("Worktree created!", vec![format!("Path: {}", path)]);
        return false;
    }

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
            // 既にトラスト済み: 確認ダイアログなしで直接フック実行
            if app
                .config
                .post_create_commands()
                .map(|c| !c.is_empty())
                .unwrap_or(false)
            {
                return true; // 直接フック実行
            }
            // エディタ起動（フックがない場合）
            if args.open_code {
                let _ = open_in_editor(EditorType::VsCode, std::path::Path::new(path));
            } else if args.open_cursor {
                let _ = open_in_editor(EditorType::Cursor, std::path::Path::new(path));
            }
            app.set_success("Worktree created!", vec![format!("Path: {}", path)]);
            false
        }
        TrustStatus::NoHooks => {
            // エディタ起動
            if args.open_code {
                let _ = open_in_editor(EditorType::VsCode, std::path::Path::new(path));
            } else if args.open_cursor {
                let _ = open_in_editor(EditorType::Cursor, std::path::Path::new(path));
            }
            app.set_success("Worktree created!", vec![format!("Path: {}", path)]);
            false
        }
        TrustStatus::NeedsConfirmation {
            commands,
            reason,
            config_path,
            config_hash,
        } => {
            // 初回またはconfig変更時: 確認ダイアログを表示
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
            false
        }
    }
}

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
            state,
            preview,
        } => {
            let widget =
                SelectListWidget::with_state(title, placeholder, input, state, preview.as_deref());
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
