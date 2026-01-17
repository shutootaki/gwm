//! removeコマンドのビュー
//!
//! 複数のworktreeを選択して削除する機能を提供します。

use std::io::stdout;
use std::time::{Duration, Instant};

use crossterm::{
    event::{Event, KeyCode, KeyModifiers},
    terminal::{disable_raw_mode, enable_raw_mode},
};
use ratatui::{backend::CrosstermBackend, Terminal, TerminalOptions, Viewport};

use crate::cli::RemoveArgs;
use crate::config::{load_config, CleanBranchMode};
use crate::error::Result;
use crate::git::{
    delete_local_branch, get_worktrees_with_details, is_branch_merged, remove_worktree,
    WorktreeStatus,
};
use crate::ui::colors::{GREEN, RED, RESET, YELLOW};
use crate::ui::event::{is_cancel_key, poll_event};
use crate::ui::summary::print_remove_summary;
use crate::ui::widgets::{MultiSelectItem, MultiSelectListWidget, MultiSelectState};
use crate::ui::{SelectItemMetadata, TextInputState};

/// TUI用インライン viewport の高さ
const TUI_INLINE_HEIGHT: u16 = 35;

/// ターミナル復元を保証するガード構造体
struct TerminalGuard;

impl Drop for TerminalGuard {
    fn drop(&mut self) {
        if let Err(e) = disable_raw_mode() {
            eprintln!("{YELLOW} Warning: Failed to restore terminal: {e}{RESET}");
        }
    }
}

/// removeコマンドを実行
///
/// # Arguments
/// * `args` - コマンド引数
///
/// # Returns
/// * 成功時: Ok(())
/// * 失敗時: GwmError
pub fn run_remove(args: RemoveArgs) -> Result<()> {
    let config = load_config();
    let worktrees = get_worktrees_with_details()?;

    // Worktreeをアイテムに変換（MAIN/ACTIVEはdisabled）
    let items: Vec<MultiSelectItem> = worktrees
        .iter()
        .map(|wt| {
            let label = wt.display_branch().to_string();
            let value = wt.path.display().to_string();

            // メタデータを構築
            let metadata = SelectItemMetadata {
                last_commit_date: wt.commit_date.clone().unwrap_or_default(),
                last_committer_name: wt.committer_name.clone().unwrap_or_default(),
                last_commit_message: wt.commit_message.clone().unwrap_or_default(),
                sync_status: wt.sync_status.clone(),
                change_status: wt.change_status.clone(),
            };

            let item = MultiSelectItem::new(label, value)
                .with_description(wt.path.display().to_string())
                .with_metadata(metadata);

            match wt.status {
                WorktreeStatus::Main => item.disabled("MAIN"),
                WorktreeStatus::Active => item.disabled("ACTIVE"),
                WorktreeStatus::Other => item,
            }
        })
        .collect();

    if items.is_empty() {
        println!("No worktrees found.");
        return Ok(());
    }

    // 選択可能なworktreeがない場合
    let selectable_count = items.iter().filter(|i| !i.disabled).count();
    if selectable_count == 0 {
        println!("No worktrees available for removal.");
        println!("(MAIN and ACTIVE worktrees cannot be removed)");
        return Ok(());
    }

    // 完全一致検索
    if let Some(ref query) = args.query {
        if let Some(item) = find_exact_match(&items, query) {
            if item.disabled {
                let reason = item.disabled_reason.as_deref().unwrap_or("This");
                return Err(crate::error::GwmError::invalid_argument(format!(
                    "Cannot remove '{}': {} worktree cannot be removed",
                    item.label, reason
                )));
            }

            // 直接削除を実行
            let clean_branch_mode = args.clean_branch.unwrap_or(config.clean_branch);
            return execute_remove(
                &[item.clone()],
                &config.main_branches,
                clean_branch_mode,
                args.force,
            );
        }
    }

    // 完全一致なし → TUIモードで選択（既存動作）
    let selected_items = run_remove_tui(&items, args.query.as_deref())?;

    if selected_items.is_empty() {
        println!("No worktrees selected.");
        return Ok(());
    }

    // 削除実行
    let clean_branch_mode = args.clean_branch.unwrap_or(config.clean_branch);

    execute_remove(
        &selected_items,
        &config.main_branches,
        clean_branch_mode,
        args.force,
    )
}

/// TUIモードで複数選択
fn run_remove_tui(
    items: &[MultiSelectItem],
    initial_query: Option<&str>,
) -> Result<Vec<MultiSelectItem>> {
    // ターミナル初期化
    enable_raw_mode()?;
    let _guard = TerminalGuard;

    let stdout = stdout();
    let backend = CrosstermBackend::new(stdout);
    let options = TerminalOptions {
        viewport: Viewport::Inline(TUI_INLINE_HEIGHT),
    };
    let mut terminal = Terminal::with_options(backend, options)?;

    // 状態初期化
    let (mut input, mut state) = match initial_query {
        Some(query) => {
            let input = TextInputState::with_value(query.to_string());
            let mut state = MultiSelectState::new(items.to_vec());
            state.update_filter(query);
            (input, state)
        }
        None => (TextInputState::new(), MultiSelectState::new(items.to_vec())),
    };

    let result = loop {
        terminal.draw(|frame| {
            let widget = MultiSelectListWidget::new(
                "Remove worktrees",
                "Search worktrees...",
                &input,
                &state,
            );
            frame.render_widget(widget, frame.area());
        })?;

        if let Some(Event::Key(key)) = poll_event(Duration::from_millis(100))? {
            // Ctrl+C / Escでキャンセル
            if is_cancel_key(&key) {
                break vec![];
            }

            match (key.modifiers, key.code) {
                // 確定
                (_, KeyCode::Enter) => {
                    if !state.selected_indices.is_empty() {
                        break state.selected_items().into_iter().cloned().collect();
                    }
                }

                // 上移動
                (_, KeyCode::Up) | (KeyModifiers::CONTROL, KeyCode::Char('p')) => {
                    state.move_up();
                }

                // 下移動
                (_, KeyCode::Down) | (KeyModifiers::CONTROL, KeyCode::Char('n')) => {
                    state.move_down();
                }

                // 選択トグル
                (_, KeyCode::Char(' ')) => {
                    state.toggle_current();
                }

                // 全選択/全解除
                (KeyModifiers::CONTROL, KeyCode::Char('a')) => {
                    state.toggle_all();
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
                // 注意: Ctrl+Aは全選択に使用されているため、先頭移動はHomeキーのみ
                (_, KeyCode::Home) => {
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
    println!();

    Ok(result)
}

/// 削除を実行
fn execute_remove(
    items: &[MultiSelectItem],
    main_branches: &[String],
    clean_branch_mode: CleanBranchMode,
    force: bool,
) -> Result<()> {
    let start = Instant::now();
    let mut removed = 0;
    let mut failed = 0;

    println!("Removing {} worktree(s)...\n", items.len());

    for item in items {
        let path = std::path::Path::new(&item.value);
        let branch = &item.label;

        match remove_worktree(path, force) {
            Ok(()) => {
                println!("{GREEN}✓ Removed worktree: {branch}{RESET}");
                handle_branch_cleanup(branch, main_branches, clean_branch_mode);
                removed += 1;
            }
            Err(e) => {
                println!("{RED}✗ Failed to remove {branch}: {e}{RESET}");
                failed += 1;
            }
        }
    }

    print_remove_summary(removed, failed, start.elapsed());

    // Return error only if all removals failed
    if failed > 0 && removed == 0 {
        return Err(crate::error::GwmError::git_command(format!(
            "Failed to remove all {} worktree(s)",
            failed
        )));
    }
    Ok(())
}

/// ブランチクリーンアップを処理
fn handle_branch_cleanup(
    branch: &str,
    main_branches: &[String],
    clean_branch_mode: CleanBranchMode,
) {
    match clean_branch_mode {
        CleanBranchMode::Auto => {
            let is_merged = is_branch_merged(branch, main_branches);
            match delete_local_branch(branch, !is_merged) {
                Ok(()) => println!("  {GREEN}✓ Deleted local branch: {branch}{RESET}"),
                Err(e) => println!("  {YELLOW}Warning: Failed to delete branch: {e}{RESET}"),
            }
        }
        CleanBranchMode::Ask => {
            let is_merged = is_branch_merged(branch, main_branches);
            let status = if is_merged { "merged" } else { "unmerged" };
            print!("  Delete local branch '{branch}' ({status})? [y/N]: ");

            use std::io::{self, Write};
            let _ = io::stdout().flush();

            let mut input = String::new();
            match io::stdin().read_line(&mut input) {
                Ok(_) => {
                    let answer = input.trim().to_lowercase();
                    if answer == "y" || answer == "yes" {
                        match delete_local_branch(branch, !is_merged) {
                            Ok(()) => {
                                println!("  {GREEN}✓ Deleted local branch: {branch}{RESET}")
                            }
                            Err(e) => {
                                println!("  {YELLOW}Warning: Failed to delete branch: {e}{RESET}")
                            }
                        }
                    } else {
                        println!("  Skipped branch deletion");
                    }
                }
                Err(e) => {
                    println!(
                        "  {YELLOW}Warning: Could not read input: {e}. Skipping branch deletion.{RESET}"
                    );
                }
            }
        }
        CleanBranchMode::Never => {}
    }
}

/// クエリで完全一致するアイテムを検索
///
/// 大文字小文字を区別せずに完全一致するアイテムを返す
fn find_exact_match<'a>(items: &'a [MultiSelectItem], query: &str) -> Option<&'a MultiSelectItem> {
    let query_lower = query.to_lowercase();
    items
        .iter()
        .find(|item| item.label.to_lowercase() == query_lower)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn create_test_item(label: &str, disabled: bool) -> MultiSelectItem {
        let item = MultiSelectItem::new(label.to_string(), format!("/path/to/{}", label));
        if disabled {
            item.disabled("MAIN")
        } else {
            item
        }
    }

    #[test]
    fn test_find_exact_match_case_insensitive() {
        let items = vec![
            create_test_item("feature/test", false),
            create_test_item("main", true),
            create_test_item("develop", false),
        ];

        // 完全一致（大文字小文字無視）
        assert!(find_exact_match(&items, "main").is_some());
        assert!(find_exact_match(&items, "MAIN").is_some());
        assert!(find_exact_match(&items, "Main").is_some());
        assert!(find_exact_match(&items, "feature/test").is_some());
        assert!(find_exact_match(&items, "FEATURE/TEST").is_some());
    }

    #[test]
    fn test_find_exact_match_partial_no_match() {
        let items = vec![
            create_test_item("feature/test", false),
            create_test_item("feature/test-2", false),
        ];

        // 部分一致では一致しない
        assert!(find_exact_match(&items, "feature").is_none());
        assert!(find_exact_match(&items, "test").is_none());

        // 完全一致のみ成功
        assert!(find_exact_match(&items, "feature/test").is_some());
    }

    #[test]
    fn test_find_exact_match_empty_query() {
        let items = vec![create_test_item("feature/test", false)];

        // 空クエリは一致しない
        assert!(find_exact_match(&items, "").is_none());
    }

    #[test]
    fn test_find_exact_match_nonexistent() {
        let items = vec![create_test_item("feature/test", false)];

        // 存在しないブランチ
        assert!(find_exact_match(&items, "nonexistent").is_none());
    }
}
