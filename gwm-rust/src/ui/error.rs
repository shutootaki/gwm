//! 構造化エラー表示モジュール
//!
//! エラーメッセージを構造化して、原因・詳細・対処法を明確に表示します。

use crate::error::GwmError;

/// 構造化されたエラーをターミナルに表示
pub fn print_structured_error(error: &GwmError) {
    let title = error.title();
    let width = 60usize;

    // タイトル部分の長さを計算
    let title_prefix = "─ ";
    let title_suffix_len = width.saturating_sub(title_prefix.len() + title.len() + 1);
    let title_suffix = "─".repeat(title_suffix_len);

    // ヘッダー
    println!("\x1b[31m┌{}{} {}┐\x1b[0m", title_prefix, title, title_suffix);
    println!("\x1b[31m│\x1b[0m");

    // エラーメッセージ
    println!("\x1b[31m│\x1b[0m  \x1b[1;31m{}\x1b[0m", error);

    // 詳細情報
    let details = error.details();
    if details.path.is_some() || details.branch.is_some() || !details.files.is_empty() || !details.extra.is_empty() {
        println!("\x1b[31m│\x1b[0m");

        if let Some(ref path) = details.path {
            println!("\x1b[31m│\x1b[0m  Path: \x1b[36m{}\x1b[0m", path.display());
        }

        if let Some(ref branch) = details.branch {
            println!("\x1b[31m│\x1b[0m  Branch: \x1b[36m{}\x1b[0m", branch);
        }

        for (key, value) in &details.extra {
            println!("\x1b[31m│\x1b[0m  {}: \x1b[36m{}\x1b[0m", key, value);
        }

        if !details.files.is_empty() {
            println!("\x1b[31m│\x1b[0m");
            println!("\x1b[31m│\x1b[0m  Modified files:");
            for file in details.files.iter().take(5) {
                println!("\x1b[31m│\x1b[0m    \x1b[33m{}\x1b[0m", file);
            }
            if details.files.len() > 5 {
                println!(
                    "\x1b[31m│\x1b[0m    \x1b[90m... and {} more\x1b[0m",
                    details.files.len() - 5
                );
            }
        }
    }

    // Suggestions
    let suggestions = error.suggestions();
    if !suggestions.is_empty() {
        println!("\x1b[31m│\x1b[0m");
        println!("\x1b[31m│\x1b[0m  \x1b[1mSuggestions:\x1b[0m");
        for (i, s) in suggestions.iter().enumerate() {
            println!("\x1b[31m│\x1b[0m    {}. {}", i + 1, s.description);
            if let Some(ref cmd) = s.command {
                println!("\x1b[31m│\x1b[0m       \x1b[36m$ {}\x1b[0m", cmd);
            }
        }
    }

    // フッター
    println!("\x1b[31m│\x1b[0m");
    let horizontal_line = "─".repeat(width);
    println!("\x1b[31m└{}┘\x1b[0m", horizontal_line);
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    #[test]
    fn test_print_structured_error_not_git_repository() {
        // テストはprintの出力をキャプチャできないため、
        // パニックしないことを確認する形でテスト
        let error = GwmError::NotGitRepository;
        print_structured_error(&error);
    }

    #[test]
    fn test_print_structured_error_branch_exists() {
        let error = GwmError::BranchExists("feature/test".to_string());
        print_structured_error(&error);
    }

    #[test]
    fn test_print_structured_error_uncommitted_changes() {
        let error = GwmError::UncommittedChanges {
            path: PathBuf::from("/path/to/worktree"),
        };
        print_structured_error(&error);
    }

    #[test]
    fn test_print_structured_error_config() {
        let error = GwmError::Config("invalid syntax".to_string());
        print_structured_error(&error);
    }
}
