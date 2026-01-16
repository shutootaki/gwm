//! cleanコマンドビュー
//!
//! `gwm clean` コマンドのエントリーポイントを提供します。
//! - マージ済み/削除済みworktreeの検出
//! - インタラクティブな選択UI
//! - 安全なworktree削除

use std::io::stdout;
use std::time::{Duration, Instant};

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
use crate::ui::colors::{DIM, GREEN, RED, RESET, YELLOW};
use crate::ui::event::{is_cancel_key, poll_event};
use crate::ui::summary::print_clean_summary;

/// ターミナル復元を保証するガード構造体
struct TerminalGuard;

impl Drop for TerminalGuard {
    fn drop(&mut self) {
        if let Err(e) = disable_raw_mode() {
            eprintln!("{YELLOW} Warning: Failed to restore terminal: {e}{RESET}");
        }
    }
}

/// cleanコマンドを実行
pub fn run_clean(args: CleanArgs) -> Result<()> {
    let config = load_config();

    println!("Scanning for cleanable worktrees...");
    let cleanable = get_cleanable_worktrees(&config);

    if cleanable.is_empty() {
        println!("{GREEN}✓ No worktrees to clean.{RESET}");
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
                "  {} {YELLOW}{}{RESET} ({})",
                cw.reason.ansi_color(),
                branch,
                reason
            );
            println!("    Path: {}", cw.worktree.path.display());
        }
        println!("\n{DIM}Run without --dry-run to actually clean.{RESET}");
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
            if is_cancel_key(&key) {
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
        Style::default()
            .fg(Color::Yellow)
            .add_modifier(Modifier::BOLD),
    );
    y += 1;

    // 一覧表示
    for cw in cleanable {
        if y >= area.y + area.height - 2 {
            break;
        }

        let branch = cw.worktree.display_branch();
        let path = cw.worktree.path.display().to_string();

        // 先頭のビュレット
        buf.set_string(area.x, y, "  ・", Style::default());
        // ブランチ名（CleanReasonに応じた色）
        let branch_display = format!("{:30}", branch);
        buf.set_string(
            area.x + 4,
            y,
            &branch_display,
            Style::default().fg(cw.reason.color()),
        );
        // パス
        buf.set_string(area.x + 34, y, &path, Style::default().fg(Color::White));
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
    let start = Instant::now();
    println!("\nCleaning {} worktree(s)...\n", targets.len());

    let mut success_count = 0;
    let mut fail_count = 0;

    for cw in targets {
        let branch = cw.worktree.display_branch();
        let path = &cw.worktree.path;

        print!("  {} {}...", cw.reason.ansi_color(), branch);

        match remove_worktree(path, false) {
            Ok(()) => {
                println!(" {GREEN}✓{RESET}");
                success_count += 1;

                // ローカルブランチも削除
                if let Err(e) = delete_local_branch(branch, false) {
                    println!("    {YELLOW}⚠ Branch not deleted: {e}{RESET}");
                } else {
                    println!("    {DIM}Deleted branch: {branch}{RESET}");
                }
            }
            Err(e) => {
                println!(" {RED}✗{RESET}");
                println!("    {RED}Error: {e}{RESET}");
                fail_count += 1;
            }
        }
    }

    print_clean_summary(success_count, fail_count, start.elapsed());
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::git::{CleanReason, CleanableWorktree, Worktree, WorktreeStatus};
    use ratatui::buffer::Buffer;
    use std::path::PathBuf;

    fn create_test_worktree(branch: &str) -> Worktree {
        Worktree {
            path: PathBuf::from(format!("/path/to/{}", branch)),
            branch: format!("refs/heads/{}", branch),
            head: "abc1234567890".to_string(),
            status: WorktreeStatus::Other,
            is_main: false,
            sync_status: None,
            change_status: None,
            last_activity: None,
            commit_date: None,
            committer_name: None,
            commit_message: None,
        }
    }

    fn create_test_cleanable(branch: &str, reason: CleanReason) -> CleanableWorktree {
        CleanableWorktree {
            worktree: create_test_worktree(branch),
            reason,
            merged_into: None,
        }
    }

    #[test]
    fn test_render_clean_confirm_ui_empty() {
        let mut buf = Buffer::empty(Rect::new(0, 0, 80, 10));
        let cleanable: Vec<CleanableWorktree> = vec![];
        render_clean_confirm_ui(&mut buf, Rect::new(0, 0, 80, 10), &cleanable);

        // タイトル行の確認
        let content: String = (0..80)
            .map(|x| buf.cell((x, 0)).unwrap().symbol().to_string())
            .collect();
        assert!(content.contains("Found 0 cleanable"));
    }

    #[test]
    fn test_render_clean_confirm_ui_with_items() {
        let cleanable = vec![
            create_test_cleanable("feature/merged", CleanReason::Merged),
            create_test_cleanable("feature/deleted", CleanReason::RemoteDeleted),
        ];
        let mut buf = Buffer::empty(Rect::new(0, 0, 100, 10));
        render_clean_confirm_ui(&mut buf, Rect::new(0, 0, 100, 10), &cleanable);

        // タイトル行に件数が含まれる
        let content: String = (0..100)
            .map(|x| buf.cell((x, 0)).unwrap().symbol().to_string())
            .collect();
        assert!(content.contains("Found 2 cleanable"));
    }

    #[test]
    fn test_render_clean_confirm_ui_footer() {
        let cleanable = vec![create_test_cleanable("test", CleanReason::Merged)];
        let mut buf = Buffer::empty(Rect::new(0, 0, 100, 10));
        render_clean_confirm_ui(&mut buf, Rect::new(0, 0, 100, 10), &cleanable);

        // フッター行にキー操作の説明が含まれる
        // y=0: タイトル, y=1: アイテム, y=2: 空行, y=3: フッター
        let footer_line: String = (0..100)
            .map(|x| buf.cell((x, 3)).unwrap().symbol().to_string())
            .collect();
        assert!(footer_line.contains("Enter") || footer_line.contains("Esc"));
    }

    #[test]
    fn test_render_clean_confirm_ui_truncation() {
        // 領域が小さい場合でもパニックしない
        let cleanable = vec![
            create_test_cleanable("feature/1", CleanReason::Merged),
            create_test_cleanable("feature/2", CleanReason::Merged),
            create_test_cleanable("feature/3", CleanReason::Merged),
        ];
        let mut buf = Buffer::empty(Rect::new(0, 0, 50, 3));
        render_clean_confirm_ui(&mut buf, Rect::new(0, 0, 50, 3), &cleanable);
        // クラッシュしなければOK
    }

    #[test]
    fn test_clean_reason_colors() {
        // CleanReasonの色分けが正しく動作する
        assert_eq!(CleanReason::Merged.color(), ratatui::style::Color::Green);
        assert_eq!(
            CleanReason::RemoteDeleted.color(),
            ratatui::style::Color::Red
        );
    }
}
