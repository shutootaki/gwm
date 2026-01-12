//! cleanコマンドビュー
//!
//! `gwm clean` コマンドのエントリーポイントを提供します。
//! - マージ済み/削除済みworktreeの検出
//! - インタラクティブな選択UI
//! - 安全なworktree削除

use std::io::stdout;
use std::time::Duration;

use crossterm::event::{Event, KeyCode};
use crossterm::terminal::{disable_raw_mode, enable_raw_mode};
use ratatui::backend::CrosstermBackend;
use ratatui::layout::Rect;
use ratatui::{Terminal, TerminalOptions, Viewport};

use crate::cli::CleanArgs;
use crate::config::load_config;
use crate::error::Result;
use crate::git::{
    delete_local_branch, get_cleanable_worktrees, remove_worktree, CleanableWorktree,
};
use crate::ui::app::TextInputState;
use crate::ui::event::poll_event;
use crate::ui::widgets::{MultiSelectItem, MultiSelectListWidget, MultiSelectState};

/// ターミナル復元を保証するガード構造体
struct TerminalGuard;

impl Drop for TerminalGuard {
    fn drop(&mut self) {
        let _ = disable_raw_mode();
    }
}

/// cleanコマンドを実行
pub fn run_clean(args: CleanArgs) -> Result<()> {
    let config = load_config();

    println!("Scanning for cleanable worktrees...");
    let cleanable = get_cleanable_worktrees(&config);

    if cleanable.is_empty() {
        println!("\x1b[32m✓ No worktrees to clean.\x1b[0m");
        println!("  All worktrees are either:");
        println!("  - Main/active worktrees");
        println!("  - Have unmerged changes");
        println!("  - Have local modifications");
        return Ok(());
    }

    // ドライランモード
    if args.dry_run {
        println!("\nWould clean {} worktree(s):\n", cleanable.len());
        for cw in &cleanable {
            let branch = cw.worktree.display_branch();
            let reason = cw.reason_text();
            println!(
                "  {} \x1b[33m{}\x1b[0m ({})",
                cw.reason.ansi_color(),
                branch,
                reason
            );
            println!("    Path: {}", cw.worktree.path.display());
        }
        println!("\n\x1b[90mRun without --dry-run to actually clean.\x1b[0m");
        return Ok(());
    }

    // 強制モード（確認なし）
    if args.force {
        return execute_clean(&cleanable);
    }

    // インタラクティブモード
    let selected = run_clean_tui(&cleanable)?;
    if selected.is_empty() {
        println!("No worktrees selected.");
        return Ok(());
    }

    execute_clean(&selected)
}

/// TUIモードでクリーンアップ対象を選択
fn run_clean_tui(cleanable: &[CleanableWorktree]) -> Result<Vec<CleanableWorktree>> {
    enable_raw_mode()?;
    let _guard = TerminalGuard;

    let backend = CrosstermBackend::new(stdout());
    let options = TerminalOptions {
        viewport: Viewport::Inline(15),
    };
    let mut terminal = Terminal::with_options(backend, options)?;

    // MultiSelectItemに変換
    let items: Vec<MultiSelectItem> = cleanable
        .iter()
        .map(|cw| {
            let branch = cw.worktree.display_branch();
            MultiSelectItem {
                label: branch.to_string(),
                value: cw.worktree.path.display().to_string(),
                description: Some(cw.reason_text()),
                disabled: false,
                disabled_reason: None,
            }
        })
        .collect();

    let mut state = MultiSelectState::new(items);
    let input = TextInputState::new();

    // デフォルトで全選択
    state.toggle_all();

    let mut should_quit = false;
    let mut confirmed = false;

    loop {
        terminal.draw(|f| {
            let area = f.area();
            render_clean_ui(f.buffer_mut(), area, &input, &state);
        })?;

        if let Some(Event::Key(key)) = poll_event(Duration::from_millis(100))? {
            match key.code {
                KeyCode::Esc => {
                    should_quit = true;
                }
                KeyCode::Enter => {
                    confirmed = true;
                    should_quit = true;
                }
                KeyCode::Up => {
                    state.move_up();
                }
                KeyCode::Down => {
                    state.move_down();
                }
                KeyCode::Char(' ') => {
                    state.toggle_current();
                }
                KeyCode::Char('a') => {
                    state.toggle_all();
                }
                _ => {}
            }
        }

        if should_quit {
            break;
        }
    }

    if confirmed {
        let selected: Vec<CleanableWorktree> = state
            .selected_indices
            .iter()
            .filter_map(|&i| cleanable.get(i).cloned())
            .collect();
        Ok(selected)
    } else {
        Ok(vec![])
    }
}

/// Clean UIを描画
fn render_clean_ui(
    buf: &mut ratatui::buffer::Buffer,
    area: Rect,
    input: &TextInputState,
    state: &MultiSelectState,
) {
    use ratatui::widgets::Widget;

    let widget = MultiSelectListWidget::new(
        "Select worktrees to clean",
        "Type to filter...",
        input,
        state,
    );
    widget.render(area, buf);
}

/// 選択されたworktreeを削除
fn execute_clean(targets: &[CleanableWorktree]) -> Result<()> {
    println!("\nCleaning {} worktree(s)...\n", targets.len());

    let mut success_count = 0;
    let mut fail_count = 0;

    for cw in targets {
        let branch = cw.worktree.display_branch();
        let path = &cw.worktree.path;

        print!("  {} {}...", cw.reason.ansi_color(), branch);

        match remove_worktree(path, false) {
            Ok(()) => {
                println!(" \x1b[32m✓\x1b[0m");
                success_count += 1;

                // ローカルブランチも削除
                if let Err(e) = delete_local_branch(branch, false) {
                    println!("    \x1b[33m⚠ Branch not deleted: {}\x1b[0m", e);
                } else {
                    println!("    \x1b[90mDeleted branch: {}\x1b[0m", branch);
                }
            }
            Err(e) => {
                println!(" \x1b[31m✗\x1b[0m");
                println!("    \x1b[31mError: {}\x1b[0m", e);
                fail_count += 1;
            }
        }
    }

    println!();
    if fail_count == 0 {
        println!(
            "\x1b[32m✓ Cleaned {} worktree(s) successfully.\x1b[0m",
            success_count
        );
    } else {
        println!(
            "\x1b[33m⚠ Cleaned {}/{} worktree(s). {} failed.\x1b[0m",
            success_count,
            targets.len(),
            fail_count
        );
    }

    Ok(())
}

