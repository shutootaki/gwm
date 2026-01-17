//! pull-mainコマンドのビュー
//!
//! メインブランチworktreeの一括更新を行います。

use crate::config::load_config;
use crate::error::Result;
use crate::git::{get_worktrees, is_already_up_to_date, pull_in_directory};

// ANSI color codes
const GREEN: &str = "\x1b[32m";
const RED: &str = "\x1b[31m";
const YELLOW: &str = "\x1b[33m";
const RESET: &str = "\x1b[0m";

/// pull-mainコマンドを実行
///
/// 設定ファイルで定義されたメインブランチ（main, master, developなど）の
/// worktreeに対して`git pull`を実行します。
///
/// # Returns
/// * 成功時: Ok(())
/// * 失敗時: GwmError
pub fn run_pull_main() -> Result<()> {
    let config = load_config();
    let worktrees = get_worktrees()?;

    // メインブランチのworktreeをフィルタ
    let main_worktrees: Vec<_> = worktrees
        .iter()
        .filter(|wt| {
            let branch = wt.display_branch();
            config.main_branches.iter().any(|main| main == branch)
        })
        .collect();

    if main_worktrees.is_empty() {
        println!("No main branch worktrees found.");
        println!();
        println!("Configured main branches: {:?}", config.main_branches);
        println!();
        println!(
            "To add a main branch worktree, run: gwm add {}",
            config.main_branches.first().unwrap_or(&"main".to_string())
        );
        return Ok(());
    }

    println!(
        "Updating {} main branch worktree(s)...\n",
        main_worktrees.len()
    );

    let mut success_count = 0;
    let mut failure_count = 0;

    for wt in main_worktrees {
        let branch = wt.display_branch();
        print!("Pulling {}... ", branch);

        match pull_in_directory(&wt.path) {
            Ok(output) => {
                if is_already_up_to_date(&output) {
                    println!("{GREEN}✓ Already up to date{RESET}");
                } else {
                    println!("{GREEN}✓ Updated{RESET}");
                    print_output_summary(&output);
                }
                success_count += 1;
            }
            Err(e) => {
                println!("{RED}✗ Failed: {e}{RESET}");
                failure_count += 1;
            }
        }
    }

    // サマリー表示
    println!();
    if failure_count == 0 {
        println!("{GREEN}All {success_count} worktree(s) updated successfully.{RESET}");
    } else {
        println!("{YELLOW}{success_count} succeeded, {failure_count} failed.{RESET}");
    }

    Ok(())
}

/// 出力の最初の数行（空行除く）を表示
fn print_output_summary(output: &str) {
    for line in output.lines().filter(|l| !l.is_empty()).take(3) {
        println!("  {line}");
    }
}

#[cfg(test)]
mod tests {
    // 統合テストはgitリポジトリが必要なため、手動テストで確認
}
