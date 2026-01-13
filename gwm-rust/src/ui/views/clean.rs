//! cleanコマンドビュー
//!
//! `gwm clean` コマンドのエントリーポイントを提供します。
//! - マージ済み/削除済みworktreeの検出
//! - インタラクティブな選択UI
//! - 安全なworktree削除

use std::io::stdout;
use std::time::Duration;

use crossterm::event::{Event, KeyCode, KeyModifiers};
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
use crate::ui::event::poll_event;

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

/// TUIモードでクリーンアップ確認を表示
///
/// Enter: 全て削除、Esc: キャンセル
fn run_clean_tui(cleanable: &[CleanableWorktree]) -> Result<Vec<CleanableWorktree>> {
    enable_raw_mode()?;
    let _guard = TerminalGuard;

    let backend = CrosstermBackend::new(stdout());
    let options = TerminalOptions {
        viewport: Viewport::Inline(cleanable.len() as u16 + 5),
    };
    let mut terminal = Terminal::with_options(backend, options)?;

    loop {
        terminal.draw(|f| {
            let area = f.area();
            render_clean_confirm_ui(f.buffer_mut(), area, cleanable);
        })?;

        if let Some(Event::Key(key)) = poll_event(Duration::from_millis(100))? {
            // Ctrl+C / Escでキャンセル
            if matches!(
                (key.modifiers, key.code),
                (KeyModifiers::CONTROL, KeyCode::Char('c')) | (_, KeyCode::Esc)
            ) {
                // カーソルをインライン領域の外に移動
                drop(_guard);
                println!();
                return Ok(vec![]);
            }
            if key.code == KeyCode::Enter {
                // カーソルをインライン領域の外に移動
                drop(_guard);
                println!();
                return Ok(cleanable.to_vec());
            }
        }
    }
}

/// Clean確認UIを描画
fn render_clean_confirm_ui(
    buf: &mut ratatui::buffer::Buffer,
    area: Rect,
    cleanable: &[CleanableWorktree],
) {
    use ratatui::style::{Color, Modifier, Style};

    let mut y = area.y;

    // タイトル: "Found N cleanable worktree(s):"
    let title = format!("Found {} cleanable worktree(s):", cleanable.len());
    buf.set_string(
        area.x,
        y,
        &title,
        Style::default().fg(Color::Yellow).add_modifier(Modifier::BOLD),
    );
    y += 1;

    // 一覧表示
    for cw in cleanable {
        if y >= area.y + area.height - 2 {
            break;
        }

        let branch = cw.worktree.display_branch();
        let path = cw.worktree.path.display().to_string();
        let line = format!("  {} {:30} {}", cw.reason.ansi_color(), branch, path);

        buf.set_string(area.x, y, &line, Style::default().fg(Color::White));
        y += 1;
    }

    // フッター（1行空けて）
    y += 1;
    if y < area.y + area.height {
        buf.set_string(
            area.x,
            y,
            "Press Enter to delete all listed worktrees, or Esc to cancel.",
            Style::default().fg(Color::Cyan),
        );
    }
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
