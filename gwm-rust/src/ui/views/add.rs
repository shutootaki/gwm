//! `gwm add` コマンドのエントリーポイント

use std::io::{self, stderr};
use std::time::{Duration, Instant};

use crossterm::event::{Event, KeyCode, KeyModifiers};
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
use crate::hooks::{
    run_post_create_hooks, run_post_create_hooks_with_commands, try_write_deferred_hooks,
    DeferredHooks,
};
use crate::shell::cwd_file::{try_write_cwd_file, CwdWriteResult};
use crate::trust::{trust_repository, verify_trust, ConfirmationReason, TrustStatus};
use crate::ui::app::{
    App, AppState, ConfirmChoice, ConfirmMetadata, SelectItem, SelectItemMetadata,
};
use crate::ui::event::{
    get_confirm_choice, get_input_value, get_selected_item, get_validation_error, handle_key_event,
    is_cancel_key, poll_event,
};
use crate::ui::summary::{
    print_add_error_summary, print_add_success_summary, AddOperationSummary, PartialState,
};
use crate::ui::widgets::{
    ConfirmWidget, NoticeWidget, SelectListWidget, SpinnerWidget, StepProgressWidget, StepState,
    TextInputWidget,
};
use crate::utils::editor::open_in_editor;
use crate::utils::{copy_ignored_files, validate_branch_name};

/// TUI用インライン viewport の高さ
/// 内訳: title(2) + stats(2) + search(2) + items(10) + preview(7) = 23
const TUI_INLINE_HEIGHT: u16 = 23;

struct TerminalGuard;

impl Drop for TerminalGuard {
    fn drop(&mut self) {
        if let Err(e) = disable_raw_mode() {
            eprintln!("\x1b[33m Warning: Failed to restore terminal: {}\x1b[0m", e);
        }
    }
}

/// TUIメインループの結果
struct MainLoopResult {
    /// worktreeのパス
    path: String,
    /// ブランチ名
    branch_name: String,
    /// hooksファイル書き込み済みフラグ
    hooks_written: bool,
}

/// 確認ダイアログ用のインライン viewport の高さを計算
const fn calc_confirm_viewport_height(command_count: usize) -> u16 {
    // title(2) + message(2) + commands_box(min 4, max 8) + choices(4) + help(2) = 14-18
    const MIN_CMD_HEIGHT: u16 = 4;
    const MAX_CMD_HEIGHT: u16 = 8;

    let raw_height = (command_count + 2) as u16;
    let cmd_height = if raw_height > MAX_CMD_HEIGHT {
        MAX_CMD_HEIGHT
    } else if raw_height < MIN_CMD_HEIGHT {
        MIN_CMD_HEIGHT
    } else {
        raw_height
    };

    cmd_height + 12
}

/// NeedsConfirmation 時に表示する確認ダイアログTUI（ジェネリック版）
fn run_trust_confirmation_tui<W: io::Write>(
    output: W,
    commands: &[String],
    reason: ConfirmationReason,
) -> Result<Option<ConfirmChoice>> {
    enable_raw_mode()?;
    let _guard = TerminalGuard;

    let viewport_height = calc_confirm_viewport_height(commands.len());
    let backend = CrosstermBackend::new(output);
    let options = TerminalOptions {
        viewport: Viewport::Inline(viewport_height),
    };
    let mut terminal = Terminal::with_options(backend, options)?;

    run_confirm_loop(&mut terminal, commands, reason)
}

/// stdout版ラッパー（後方互換）
fn run_trust_confirmation_tui_stdout(
    commands: &[String],
    reason: ConfirmationReason,
) -> Result<Option<ConfirmChoice>> {
    run_trust_confirmation_tui(io::stdout(), commands, reason)
}

/// stderr版ラッパー（後方互換）
fn run_trust_confirmation_tui_stderr(
    commands: &[String],
    reason: ConfirmationReason,
) -> Result<Option<ConfirmChoice>> {
    run_trust_confirmation_tui(stderr(), commands, reason)
}

/// 確認ダイアログのメインループ
fn run_confirm_loop<W: io::Write>(
    terminal: &mut Terminal<CrosstermBackend<W>>,
    commands: &[String],
    reason: ConfirmationReason,
) -> Result<Option<ConfirmChoice>> {
    let mut selected = ConfirmChoice::Once;
    let title = "Run post-create hooks?";
    let message = reason.description();
    let commands_vec: Vec<String> = commands.to_vec();

    loop {
        terminal.draw(|frame| {
            let widget = ConfirmWidget::new(title, message, &commands_vec, selected);
            frame.render_widget(widget, frame.area());
        })?;

        if let Some(Event::Key(key)) = poll_event(Duration::from_millis(100))? {
            // Ctrl+C は即座にキャンセル
            if key.modifiers.contains(KeyModifiers::CONTROL)
                && matches!(key.code, KeyCode::Char('c'))
            {
                return Ok(None);
            }

            match key.code {
                KeyCode::Esc => {
                    return Ok(Some(ConfirmChoice::Cancel));
                }
                KeyCode::Enter => {
                    return Ok(Some(selected));
                }
                KeyCode::Left | KeyCode::Up => {
                    selected = selected.prev();
                }
                KeyCode::Right | KeyCode::Down | KeyCode::Tab => {
                    selected = selected.next();
                }
                KeyCode::Char('t') | KeyCode::Char('T') | KeyCode::Char('1') => {
                    selected = ConfirmChoice::Trust;
                }
                KeyCode::Char('o') | KeyCode::Char('O') | KeyCode::Char('2') => {
                    selected = ConfirmChoice::Once;
                }
                KeyCode::Char('c') | KeyCode::Char('C') | KeyCode::Char('3') => {
                    selected = ConfirmChoice::Cancel;
                }
                _ => {}
            }
        }
    }
}

/// エディタ起動ヘルパー（エラーをユーザーに通知）
fn maybe_open_editor(args: &AddArgs, path: &std::path::Path) {
    if let Some(editor) = args.editor() {
        if let Err(e) = open_in_editor(editor, path) {
            eprintln!(
                "\x1b[33m Warning: Could not open {}: {}\x1b[0m",
                editor.display_name(),
                e
            );
            eprintln!(
                "  Make sure '{}' command is in your PATH.",
                editor.command()
            );
        }
    }
}

/// シェル統合（パスのみ出力）向けに、ignored files をコピーして stderr にログを出す。
fn maybe_copy_ignored_files_for_shell(
    config_source: &ConfigWithSource,
    worktree_path: &std::path::Path,
) {
    if let Some(ref copy_config) = config_source.config.copy_ignored_files {
        if let Some(ref repo_root) = config_source.repo_root {
            match copy_ignored_files(repo_root, worktree_path, copy_config) {
                Ok(copy_result) => {
                    for file in &copy_result.copied {
                        eprintln!("Copied: {}", file);
                    }
                }
                Err(e) => {
                    eprintln!(
                        "\x1b[33m⚠ Warning: Failed to copy ignored files: {}\x1b[0m",
                        e
                    );
                }
            }
        }
    }
}

/// addコマンドを実行
pub async fn run_add(args: AddArgs) -> Result<()> {
    // --run-deferred-hooks オプションが指定された場合、hooksのみを実行
    if let Some(ref hooks_file_path) = args.run_deferred_hooks {
        return run_deferred_hooks(hooks_file_path);
    }

    let config_source = load_config_with_source();

    if let Some(ref branch_name) = args.branch_name {
        return execute_add_direct(&config_source, branch_name.clone(), &args).await;
    }

    run_add_tui(config_source, args).await
}

/// deferred hooksを実行（cd完了後にシェル関数から呼び出される）
fn run_deferred_hooks(hooks_file_path: &str) -> Result<()> {
    use std::path::Path;

    let path = Path::new(hooks_file_path);

    // ファイルが存在しない場合は何もしない（ユーザーがキャンセルした場合などに発生）
    if !path.exists() {
        // デバッグ用：ファイルが見つからない場合のログ
        // 通常はhooksが設定されていない場合やキャンセル時に発生するため警告レベルではない
        if std::env::var("GWM_DEBUG").is_ok() {
            eprintln!(
                "\x1b[90m[debug] Deferred hooks file not found: {}\x1b[0m",
                hooks_file_path
            );
        }
        return Ok(());
    }

    // hooksファイルを読み込み
    let deferred = DeferredHooks::read_from_file(path)?;

    // trust_verifiedがfalseなら実行しない
    if !deferred.trust_verified {
        DeferredHooks::delete_file(path)?;
        return Ok(());
    }

    // コマンドがなければ何もしない
    if deferred.commands.is_empty() {
        DeferredHooks::delete_file(path)?;
        return Ok(());
    }

    // HookContextを作成
    let context = deferred.to_hook_context();

    // hooks実行（deferred.commandsを直接使用）
    let hook_result = run_post_create_hooks_with_commands(&deferred.commands, &context)?;

    // hooksファイルを削除
    DeferredHooks::delete_file(path)?;

    if !hook_result.success {
        if let Some(failed_cmd) = &hook_result.failed_command {
            return Err(GwmError::hook(format!(
                "Command failed: {} (exit code: {})",
                failed_cmd,
                hook_result.exit_code.unwrap_or(1)
            )));
        }
    }

    Ok(())
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

    let output_path_only = args.should_output_path_only();

    // CLI進捗表示（パス出力モードではstderr）
    let print_progress = |msg: &str| {
        if output_path_only {
            eprintln!("{}", msg);
        } else {
            println!("{}", msg);
        }
    };

    print_progress("\x1b[36mCreating worktree...\x1b[0m");
    print_progress("  \x1b[90m[1/2] ⠙ Creating worktree\x1b[0m");

    let result = add_worktree(&config_source.config, &options)?;

    print_progress("  \x1b[32m[1/2] ✓ Creating worktree\x1b[0m");
    print_progress("  \x1b[32m[2/2] ✓ Checking out branch\x1b[0m");

    if output_path_only {
        // パス出力モード: ignored files コピー（ログは stderr へ）
        maybe_copy_ignored_files_for_shell(config_source, &result.path);

        // hooksをdeferred実行用にファイルに書き出す
        // （実際のhooks実行はcd完了後にシェル関数から呼び出される）
        if !args.skip_hooks {
            write_deferred_hooks_for_shell(config_source, &branch, &result.path)?;
        }

        // パス出力
        match try_write_cwd_file(&result.path) {
            Ok(CwdWriteResult::Written) => {}
            Ok(CwdWriteResult::EnvNotSet) => println!("{}", result.path.display()),
            Err(e) => {
                eprintln!("\x1b[33m Warning: Failed to write cwd file: {}\x1b[0m", e);
                println!("{}", result.path.display());
            }
        }
        return Ok(());
    }

    // --no-cd またはエディタ起動指定時: 従来の動作（成功メッセージ + フック実行）
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

    // エディタを先に起動してからhooksを実行
    if let Some(editor) = args.editor() {
        open_in_editor(editor, &result.path)?;
    }

    if !args.skip_hooks {
        execute_hooks_direct(config_source, &branch, &result.path)?;
    }

    Ok(())
}

fn execute_hooks_direct(
    config_source: &ConfigWithSource,
    branch: &str,
    worktree_path: &std::path::Path,
) -> Result<()> {
    execute_hooks_direct_impl(config_source, branch, worktree_path, false)
}

/// パス出力モード用: hooksをdeferred実行用にファイルに書き出す
///
/// trust検証と確認ダイアログは通常通り表示するが、hooksの実行は行わない。
/// 代わりに、cd完了後にシェル関数が`gwm add --run-deferred-hooks`を呼び出して
/// hooksを実行する。
fn write_deferred_hooks_for_shell(
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

    let context = config_source.build_hook_context(worktree_path, branch);

    match trust_status {
        TrustStatus::Trusted | TrustStatus::GlobalConfig => {
            // 既に信頼済み: hooksをファイルに書き出す
            let commands = config_source
                .config
                .post_create_commands()
                .map(|c| c.to_vec())
                .unwrap_or_default();
            // deferred hooks の書き出しを試みる
            if !try_write_deferred_hooks(&context, commands, true)? {
                // GWM_HOOKS_FILE が設定されていない場合は直接実行
                run_hooks_impl(config_source, branch, worktree_path)?;
            }
        }
        TrustStatus::NoHooks => {
            // hooksなし: 何もしない
        }
        TrustStatus::NeedsConfirmation {
            commands,
            reason,
            config_path,
            config_hash,
        } => {
            // 確認ダイアログを表示してユーザーに選択させる
            let choice = run_trust_confirmation_tui_stderr(&commands, reason)?;

            // TUI表示後の改行
            eprintln!();

            match choice {
                Some(ConfirmChoice::Trust) => {
                    // キャッシュに保存してhooksをファイルに書き出す
                    if let Some(ref repo_root) = config_source.repo_root {
                        if let Err(e) = trust_repository(
                            &repo_root.display().to_string(),
                            config_path,
                            config_hash,
                            commands.clone(),
                        ) {
                            eprintln!(
                                "\x1b[33m Warning: Could not save trust setting: {}\x1b[0m",
                                e
                            );
                        }
                    }
                    // deferred hooks の書き出しを試みる
                    if !try_write_deferred_hooks(&context, commands.clone(), true)? {
                        // GWM_HOOKS_FILE が設定されていない場合は直接実行
                        let hook_result = run_post_create_hooks_with_commands(&commands, &context)?;
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
                }
                Some(ConfirmChoice::Once) => {
                    // 一度だけhooksを実行（キャッシュに保存しない）
                    // deferred hooks の書き出しを試みる
                    if !try_write_deferred_hooks(&context, commands.clone(), true)? {
                        // GWM_HOOKS_FILE が設定されていない場合は直接実行
                        let hook_result = run_post_create_hooks_with_commands(&commands, &context)?;
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
                }
                Some(ConfirmChoice::Cancel) | None => {
                    // スキップ: hooksファイルは書き出さない
                    eprintln!("\x1b[33mHooks skipped.\x1b[0m");
                }
            }
        }
    }

    Ok(())
}

fn execute_hooks_direct_impl(
    config_source: &ConfigWithSource,
    branch: &str,
    worktree_path: &std::path::Path,
    use_stderr: bool,
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
            run_hooks_impl(config_source, branch, worktree_path)?;
        }
        TrustStatus::NoHooks => {}
        TrustStatus::NeedsConfirmation {
            commands,
            reason,
            config_path,
            config_hash,
        } => {
            // 確認ダイアログを表示してユーザーに選択させる
            let choice = if use_stderr {
                run_trust_confirmation_tui_stderr(&commands, reason)?
            } else {
                run_trust_confirmation_tui_stdout(&commands, reason)?
            };

            // TUI表示後の改行
            if use_stderr {
                eprintln!();
            } else {
                println!();
            }

            match choice {
                Some(ConfirmChoice::Trust) => {
                    // キャッシュに保存して hooks 実行
                    if let Some(ref repo_root) = config_source.repo_root {
                        if let Err(e) = trust_repository(
                            &repo_root.display().to_string(),
                            config_path,
                            config_hash,
                            commands.clone(),
                        ) {
                            eprintln!(
                                "\x1b[33m Warning: Could not save trust setting: {}\x1b[0m",
                                e
                            );
                        }
                    }
                    run_hooks_impl(config_source, branch, worktree_path)?;
                }
                Some(ConfirmChoice::Once) => {
                    // 一度だけ hooks 実行（キャッシュに保存しない）
                    run_hooks_impl(config_source, branch, worktree_path)?;
                }
                Some(ConfirmChoice::Cancel) | None => {
                    // スキップ
                    let msg = "\x1b[33mHooks skipped.\x1b[0m";
                    if use_stderr {
                        eprintln!("{}", msg);
                    } else {
                        println!("{}", msg);
                    }
                }
            }
        }
    }

    Ok(())
}

/// hooksを実行する共通関数
fn run_hooks_impl(
    config_source: &ConfigWithSource,
    branch: &str,
    worktree_path: &std::path::Path,
) -> Result<()> {
    let context = config_source.build_hook_context(worktree_path, branch);

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

    Ok(())
}

async fn run_add_tui(config_source: ConfigWithSource, args: AddArgs) -> Result<()> {
    enable_raw_mode()?;
    let _guard = TerminalGuard;

    // TUIはstderrへ描画する（stdoutはシェル統合用のパス出力に利用する）
    let backend = CrosstermBackend::new(stderr());
    let options = TerminalOptions {
        viewport: Viewport::Inline(TUI_INLINE_HEIGHT),
    };
    let mut terminal = Terminal::with_options(backend, options)?;
    let mut app = App::new(config_source.config.clone());

    if args.remote {
        app.set_loading("Fetching remote branches...");
    } else {
        app.set_text_input("Create new worktree", "Enter new branch name:");
    }

    let output_path_only = args.should_output_path_only();
    let result = run_main_loop(&mut terminal, &mut app, &args, &config_source).await;

    // カーソルをインライン領域の外に移動（キャンセル時や正常終了時に必要）
    // execute_hooks_and_finish経由で終了した場合は既にprintln!()が呼ばれているが、
    // それ以外のパス（キャンセル、エラー表示後のEsc等）では必要
    drop(_guard);
    match result {
        Ok(Some(main_loop_result)) => {
            // stdoutを汚さずにTUI領域を抜ける
            eprintln!();
            maybe_copy_ignored_files_for_shell(
                &config_source,
                std::path::Path::new(&main_loop_result.path),
            );

            // hooksをdeferred実行用にファイルに書き出す
            // （実際のhooks実行はcd完了後にシェル関数から呼び出される）
            // ただし、TUI内で既に書き込み済みの場合はスキップ
            if !args.skip_hooks && !main_loop_result.hooks_written {
                if let Err(e) = write_deferred_hooks_for_shell(
                    &config_source,
                    &main_loop_result.branch_name,
                    std::path::Path::new(&main_loop_result.path),
                ) {
                    eprintln!("\x1b[31m✗ Hook error: {}\x1b[0m", e);
                }
            }

            match try_write_cwd_file(std::path::Path::new(&main_loop_result.path)) {
                Ok(CwdWriteResult::Written) => {}
                Ok(CwdWriteResult::EnvNotSet) => println!("{}", main_loop_result.path),
                Err(e) => {
                    eprintln!("\x1b[33m Warning: Failed to write cwd file: {}\x1b[0m", e);
                    println!("{}", main_loop_result.path);
                }
            }
            Ok(())
        }
        Ok(None) => {
            if output_path_only {
                eprintln!();
            } else {
                println!();
            }
            Ok(())
        }
        Err(e) => {
            if output_path_only {
                eprintln!();
            } else {
                println!();
            }
            Err(e)
        }
    }
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
                sync_status: None,
                change_status: None,
            }),
        })
        .collect())
}

/// 戻り値: Ok(Some(result)) = 成功, Ok(None) = キャンセル
async fn run_main_loop(
    terminal: &mut Terminal<CrosstermBackend<io::Stderr>>,
    app: &mut App,
    args: &AddArgs,
    config_source: &ConfigWithSource,
) -> Result<Option<MainLoopResult>> {
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
                            return Ok(None);
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
                                // Progress状態に遷移してworktreeを作成
                                let has_copy_config =
                                    config_source.config.copy_ignored_files.is_some();
                                let has_hooks = config_source
                                    .config
                                    .post_create_commands()
                                    .map(|c| !c.is_empty())
                                    .unwrap_or(false)
                                    && !args.skip_hooks;

                                let mut steps = create_worktree_steps(has_copy_config, has_hooks);
                                steps[0] =
                                    StepState::InProgress("Creating worktree".to_string(), None);
                                app.set_progress("Creating worktree...", steps);

                                // 進捗表示を描画
                                terminal.draw(|f| {
                                    let area = f.area();
                                    render_app(f.buffer_mut(), area, app, frame_count);
                                })?;

                                let result = create_worktree_from_input(app, &branch, args);
                                match result {
                                    Ok((path, branch_name)) => {
                                        // ステップ1,2完了
                                        if let AppState::Progress { steps, .. } = &mut app.state {
                                            steps[0] = StepState::Completed(
                                                "Creating worktree".to_string(),
                                            );
                                            steps[1] = StepState::Completed(
                                                "Checking out branch".to_string(),
                                            );
                                        }

                                        terminal.draw(|f| {
                                            let area = f.area();
                                            render_app(f.buffer_mut(), area, app, frame_count);
                                        })?;

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
                                            // 信頼済み: hooksを実行
                                            if args.should_output_path_only() {
                                                // パス出力モード: deferred hooksを書き出し
                                                if let Some((path, branch_name)) =
                                                    write_deferred_hooks_and_return_path(
                                                        &created_worktree,
                                                        config_source,
                                                    )?
                                                {
                                                    // 書き出し成功 → シェル統合でhooks実行
                                                    return Ok(Some(MainLoopResult {
                                                        path,
                                                        branch_name,
                                                        hooks_written: true,
                                                    }));
                                                }
                                                // 書き出しなし → 直接実行（下にフォールスルー）
                                            }
                                            // Progress状態を描画して更新を反映
                                            terminal.draw(|f| {
                                                let area = f.area();
                                                render_app(f.buffer_mut(), area, app, frame_count);
                                            })?;
                                            execute_hooks_and_finish(
                                                app,
                                                &created_worktree,
                                                config_source,
                                                args,
                                            );
                                        }
                                        // should_execute_hooks == false の場合:
                                        // - 確認ダイアログが表示されている (NeedsConfirmation)
                                        // - または成功表示されている (NoHooks, skip_hooks)
                                        // ループを続けてユーザー入力を待つ
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

                            // Progress状態に遷移してworktreeを作成
                            let has_copy_config = config_source.config.copy_ignored_files.is_some();
                            let has_hooks = config_source
                                .config
                                .post_create_commands()
                                .map(|c| !c.is_empty())
                                .unwrap_or(false)
                                && !args.skip_hooks;

                            let mut steps = create_worktree_steps(has_copy_config, has_hooks);
                            steps[0] = StepState::InProgress("Creating worktree".to_string(), None);
                            app.set_progress("Creating worktree...", steps);

                            // 進捗表示を描画
                            terminal.draw(|f| {
                                let area = f.area();
                                render_app(f.buffer_mut(), area, app, frame_count);
                            })?;

                            let result = create_worktree_from_remote(app, &branch);
                            match result {
                                Ok((path, branch_name)) => {
                                    // ステップ1,2完了
                                    if let AppState::Progress { steps, .. } = &mut app.state {
                                        steps[0] =
                                            StepState::Completed("Creating worktree".to_string());
                                        steps[1] =
                                            StepState::Completed("Checking out branch".to_string());
                                    }

                                    terminal.draw(|f| {
                                        let area = f.area();
                                        render_app(f.buffer_mut(), area, app, frame_count);
                                    })?;

                                    created_worktree = Some((path.clone(), branch_name.clone()));
                                    let should_execute_hooks = handle_creation_success(
                                        app,
                                        &path,
                                        &branch_name,
                                        args,
                                        config_source,
                                    );
                                    if should_execute_hooks {
                                        // 信頼済み: hooksを実行
                                        if args.should_output_path_only() {
                                            // パス出力モード: deferred hooksを書き出し
                                            if let Some((path, branch_name)) =
                                                write_deferred_hooks_and_return_path(
                                                    &created_worktree,
                                                    config_source,
                                                )?
                                            {
                                                // 書き出し成功 → シェル統合でhooks実行
                                                return Ok(Some(MainLoopResult {
                                                    path,
                                                    branch_name,
                                                    hooks_written: true,
                                                }));
                                            }
                                            // 書き出しなし → 直接実行（下にフォールスルー）
                                        }
                                        // Progress状態を描画して更新を反映
                                        terminal.draw(|f| {
                                            let area = f.area();
                                            render_app(f.buffer_mut(), area, app, frame_count);
                                        })?;
                                        execute_hooks_and_finish(
                                            app,
                                            &created_worktree,
                                            config_source,
                                            args,
                                        );
                                    }
                                    // should_execute_hooks == false の場合:
                                    // 確認ダイアログまたは成功表示、ループを続ける
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
                                            if let Err(e) = trust_repository(
                                                &repo_root.display().to_string(),
                                                metadata.config_path.clone(),
                                                metadata.config_hash.clone(),
                                                app.config
                                                    .post_create_commands()
                                                    .map(|c| c.to_vec())
                                                    .unwrap_or_default(),
                                            ) {
                                                eprintln!("\x1b[33m Warning: Could not save trust setting: {}\x1b[0m", e);
                                            }
                                        }
                                    }
                                    if args.should_output_path_only() {
                                        // パス出力モード: deferred hooksを書き出し
                                        if let Some((path, branch_name)) =
                                            write_deferred_hooks_and_return_path(
                                                &created_worktree,
                                                config_source,
                                            )?
                                        {
                                            // 書き出し成功 → シェル統合でhooks実行
                                            return Ok(Some(MainLoopResult {
                                                path,
                                                branch_name,
                                                hooks_written: true,
                                            }));
                                        }
                                        // 書き出しなし → 直接実行（下にフォールスルー）
                                    }
                                    // hooksステップをInProgressに更新して描画
                                    let hooks_step_idx = get_hooks_step_index(config_source);
                                    app.set_progress(
                                        "Running hooks...",
                                        create_worktree_steps_completed(
                                            config_source,
                                            hooks_step_idx,
                                        ),
                                    );
                                    terminal.draw(|f| {
                                        let area = f.area();
                                        render_app(f.buffer_mut(), area, app, frame_count);
                                    })?;
                                    execute_hooks_and_finish(
                                        app,
                                        &created_worktree,
                                        config_source,
                                        args,
                                    );
                                }
                                ConfirmChoice::Once => {
                                    if args.should_output_path_only() {
                                        // パス出力モード: deferred hooksを書き出し
                                        if let Some((path, branch_name)) =
                                            write_deferred_hooks_and_return_path(
                                                &created_worktree,
                                                config_source,
                                            )?
                                        {
                                            // 書き出し成功 → シェル統合でhooks実行
                                            return Ok(Some(MainLoopResult {
                                                path,
                                                branch_name,
                                                hooks_written: true,
                                            }));
                                        }
                                        // 書き出しなし → 直接実行（下にフォールスルー）
                                    }
                                    // hooksステップをInProgressに更新して描画
                                    let hooks_step_idx = get_hooks_step_index(config_source);
                                    app.set_progress(
                                        "Running hooks...",
                                        create_worktree_steps_completed(
                                            config_source,
                                            hooks_step_idx,
                                        ),
                                    );
                                    terminal.draw(|f| {
                                        let area = f.area();
                                        render_app(f.buffer_mut(), area, app, frame_count);
                                    })?;
                                    execute_hooks_and_finish(
                                        app,
                                        &created_worktree,
                                        config_source,
                                        args,
                                    );
                                }
                                ConfirmChoice::Cancel => {
                                    if args.should_output_path_only() {
                                        // パス出力モード: hooksスキップしてパスを返す
                                        if let Some((path, branch_name)) = &created_worktree {
                                            return Ok(Some(MainLoopResult {
                                                path: path.clone(),
                                                branch_name: branch_name.clone(),
                                                hooks_written: false, // hooksはスキップ
                                            }));
                                        }
                                    }
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

    Ok(None)
}

/// パス出力モード用: deferred hooksをファイルに書き出してパスを返す
///
/// TUI確認ダイアログからの選択後に呼ばれる。
/// hooksは実行せず、deferred hooksファイルに書き出してパスを返す。
/// 実際のhooks実行はcd完了後にシェル関数から呼び出される。
fn write_deferred_hooks_and_return_path(
    created_worktree: &Option<(String, String)>,
    config_source: &ConfigWithSource,
) -> Result<Option<(String, String)>> {
    let Some((path, branch_name)) = created_worktree else {
        return Ok(None);
    };

    // hooksをdeferred実行用にファイルに書き出す
    let worktree_path = std::path::Path::new(path);
    let context = config_source.build_hook_context(worktree_path, branch_name);
    let commands = config_source.get_post_create_commands();

    match try_write_deferred_hooks(&context, commands, true) {
        Ok(true) => {
            // 書き出し成功 → パスを返す（シェル統合でhooks実行）
            Ok(Some((path.clone(), branch_name.clone())))
        }
        Ok(false) => {
            // 書き出しなし（GWM_HOOKS_FILEが設定されていない）
            // → 直接実行なのでhooksを直接実行する必要あり
            Ok(None)
        }
        Err(e) => {
            eprintln!("\x1b[31m✗ Hook error: {}\x1b[0m", e);
            Ok(None)
        }
    }
}

fn execute_hooks_and_finish(
    app: &mut App,
    created_worktree: &Option<(String, String)>,
    config_source: &ConfigWithSource,
    args: &AddArgs,
) {
    if let Some((path, branch_name)) = created_worktree {
        // フック実行前にrawモードを無効化してTUIを停止
        if let Err(e) = disable_raw_mode() {
            eprintln!("\x1b[33m Warning: Failed to restore terminal: {}\x1b[0m", e);
        }

        // 改行を出力してTUI描画領域から抜ける
        println!();

        let operation_start = Instant::now();
        let worktree_path = std::path::Path::new(path);
        let context = config_source.build_hook_context(worktree_path, branch_name);

        // エディタを先に起動してからhooksを実行
        maybe_open_editor(args, &context.worktree_path);

        // コピーされたファイルを収集
        let copied_files = collect_copied_files(config_source, worktree_path);

        match run_post_create_hooks(&config_source.config, &context) {
            Ok(result) if result.success => {
                let summary = AddOperationSummary {
                    branch: branch_name.clone(),
                    path: path.clone(),
                    base_branch: args.from_branch.clone(),
                    base_commit: None,
                    duration: operation_start.elapsed(),
                    hooks: Some(result),
                    copied_files,
                };
                print_add_success_summary(&summary);
            }
            Ok(result) => {
                let error_msg = result
                    .failed_command
                    .as_ref()
                    .map(|c| format!("Hook failed: {}", c))
                    .unwrap_or_else(|| "Unknown hook error".to_string());
                let partial_state = PartialState::hook_failed(!copied_files.is_empty());
                print_add_error_summary(
                    branch_name,
                    operation_start.elapsed(),
                    &error_msg,
                    &partial_state,
                );
            }
            Err(e) => {
                let partial_state = PartialState::hook_failed(!copied_files.is_empty());
                print_add_error_summary(
                    branch_name,
                    operation_start.elapsed(),
                    &e.to_string(),
                    &partial_state,
                );
            }
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

/// コピーされたファイルのリストを収集する
fn collect_copied_files(
    config_source: &ConfigWithSource,
    worktree_path: &std::path::Path,
) -> Vec<String> {
    if let Some(ref copy_config) = config_source.config.copy_ignored_files {
        if let Some(ref repo_root) = config_source.repo_root {
            if let Ok(result) = copy_ignored_files(repo_root, worktree_path, copy_config) {
                return result.copied;
            }
        }
    }
    Vec::new()
}

/// worktree作成の初期ステップを生成
fn create_worktree_steps(has_copy_config: bool, has_hooks: bool) -> Vec<StepState> {
    let mut steps = vec![
        StepState::Pending("Creating worktree".to_string()),
        StepState::Pending("Checking out branch".to_string()),
    ];
    if has_copy_config {
        steps.push(StepState::Pending("Copying ignored files".to_string()));
    }
    if has_hooks {
        steps.push(StepState::Pending("Running hooks".to_string()));
    }
    steps
}

/// hooksステップのインデックスを取得
fn get_hooks_step_index(config_source: &ConfigWithSource) -> usize {
    if config_source.config.copy_ignored_files.is_some() {
        3 // [0] Creating, [1] Checking out, [2] Copying, [3] Hooks
    } else {
        2 // [0] Creating, [1] Checking out, [2] Hooks
    }
}

/// Confirmダイアログ後に使用するステップ状態を生成（hooksがInProgress）
fn create_worktree_steps_completed(
    config_source: &ConfigWithSource,
    _hooks_step_idx: usize,
) -> Vec<StepState> {
    let has_copy_config = config_source.config.copy_ignored_files.is_some();
    let mut steps = vec![
        StepState::Completed("Creating worktree".to_string()),
        StepState::Completed("Checking out branch".to_string()),
    ];
    if has_copy_config {
        steps.push(StepState::Completed("Copying ignored files".to_string()));
    }
    // hooksステップはInProgress
    steps.push(StepState::InProgress("Running hooks".to_string(), None));
    steps
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
    // 無視ファイルのコピー（エラーは警告として表示）
    if let Some(ref copy_config) = config_source.config.copy_ignored_files {
        if let Some(ref repo_root) = config_source.repo_root {
            // Progress状態を更新: ファイルコピー中
            app.update_progress_step(
                2,
                StepState::InProgress("Copying ignored files".to_string(), None),
            );

            match copy_ignored_files(repo_root, std::path::Path::new(path), copy_config) {
                Ok(result) if result.has_copied() => {
                    // コピー成功: Progress状態を完了に更新
                    app.update_progress_step(
                        2,
                        StepState::Completed("Copying ignored files".to_string()),
                    );
                }
                Ok(_) => {
                    // コピー対象なし: Progress状態を完了に更新
                    app.update_progress_step(
                        2,
                        StepState::Completed("Copying ignored files".to_string()),
                    );
                }
                Err(e) => {
                    // エラー: Progress状態を失敗に更新
                    app.update_progress_step(
                        2,
                        StepState::Failed("Copying ignored files".to_string()),
                    );
                    eprintln!(
                        "\x1b[33m Warning: Failed to copy ignored files: {}\x1b[0m",
                        e
                    );
                }
            }
        }
    }

    let worktree_path = std::path::Path::new(path);

    if args.skip_hooks {
        maybe_open_editor(args, worktree_path);
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
                // hooksステップをInProgressに更新
                let hooks_step_idx = get_hooks_step_index(config_source);
                app.update_progress_step(
                    hooks_step_idx,
                    StepState::InProgress("Running hooks".to_string(), None),
                );
                return true; // 直接フック実行
            }
            // エディタ起動（フックがない場合）
            maybe_open_editor(args, worktree_path);
            app.set_success("Worktree created!", vec![format!("Path: {}", path)]);
            false
        }
        TrustStatus::NoHooks => {
            maybe_open_editor(args, worktree_path);
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

        AppState::Progress { title, steps } => {
            let widget = StepProgressWidget::new(title, steps).frame(frame_count);
            widget.render(area, buf);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_calc_confirm_viewport_height_zero_commands() {
        // コマンド0個 → 最小高さ (MIN_CMD_HEIGHT=4 + 12 = 16)
        let height = calc_confirm_viewport_height(0);
        assert_eq!(height, 16);
    }

    #[test]
    fn test_calc_confirm_viewport_height_one_command() {
        // コマンド1個 → raw_height=3, MIN_CMD_HEIGHT=4 適用 → 16
        let height = calc_confirm_viewport_height(1);
        assert_eq!(height, 16);
    }

    #[test]
    fn test_calc_confirm_viewport_height_two_commands() {
        // コマンド2個 → raw_height=4 = MIN_CMD_HEIGHT → 16
        let height = calc_confirm_viewport_height(2);
        assert_eq!(height, 16);
    }

    #[test]
    fn test_calc_confirm_viewport_height_mid_range() {
        // コマンド3個 → raw_height=5, 5+12=17
        assert_eq!(calc_confirm_viewport_height(3), 17);

        // コマンド4個 → raw_height=6, 6+12=18
        assert_eq!(calc_confirm_viewport_height(4), 18);

        // コマンド5個 → raw_height=7, 7+12=19
        assert_eq!(calc_confirm_viewport_height(5), 19);
    }

    #[test]
    fn test_calc_confirm_viewport_height_at_max_boundary() {
        // コマンド6個 → raw_height=8 = MAX_CMD_HEIGHT → 20
        let height = calc_confirm_viewport_height(6);
        assert_eq!(height, 20);
    }

    #[test]
    fn test_calc_confirm_viewport_height_exceeds_max() {
        // コマンド7個以上 → MAX_CMD_HEIGHT=8 適用 → 20
        assert_eq!(calc_confirm_viewport_height(7), 20);
        assert_eq!(calc_confirm_viewport_height(10), 20);
        assert_eq!(calc_confirm_viewport_height(100), 20);
    }

    #[test]
    fn test_tui_inline_height_constant() {
        // TUI_INLINE_HEIGHT定数の値確認
        assert_eq!(TUI_INLINE_HEIGHT, 23);
    }

    #[test]
    fn test_main_loop_result_construction() {
        // MainLoopResultの構造確認
        let result = MainLoopResult {
            path: "/path/to/worktree".to_string(),
            branch_name: "feature/test".to_string(),
            hooks_written: true,
        };

        assert_eq!(result.path, "/path/to/worktree");
        assert_eq!(result.branch_name, "feature/test");
        assert!(result.hooks_written);
    }

    #[test]
    fn test_main_loop_result_hooks_not_written() {
        // hooks_written=false の場合
        let result = MainLoopResult {
            path: "/path/to/worktree".to_string(),
            branch_name: "feature/cancel".to_string(),
            hooks_written: false,
        };

        assert!(!result.hooks_written);
    }
}
