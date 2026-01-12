//! ブランチ名バリデーションユーティリティ
//!
//! Gitブランチ名の検証とサニタイズ機能を提供します。

use crate::config::Config;
use crate::git::get_repository_name;

/// ブランチ名のバリデーション
///
/// # ルール（Git公式の制約に準拠）
/// - 空白不可
/// - 使用禁止文字: ~ ^ : ? * [ ] \ @
/// - 先頭/末尾のドット不可
/// - 連続ドット不可
/// - スペース不可
/// - 最大50文字
/// - `.lock` サフィックス不可
/// - `@{` を含めない（reflog構文との衝突回避）
/// - 連続スラッシュ不可
/// - 末尾スラッシュ不可
///
/// # Returns
/// - `None`: バリデーション成功
/// - `Some(String)`: エラーメッセージ
///
/// # Example
/// ```ignore
/// assert!(validate_branch_name("feature/test").is_none());
/// assert!(validate_branch_name("invalid~name").is_some());
/// ```
pub fn validate_branch_name(name: &str) -> Option<String> {
    let name = name.trim();

    if name.is_empty() {
        return Some("Branch name cannot be empty".to_string());
    }

    // 禁止文字チェック
    let invalid_chars = ['~', '^', ':', '?', '*', '[', ']', '\\', '@'];
    for c in invalid_chars {
        if name.contains(c) {
            return Some(format!("Branch name contains invalid character: {}", c));
        }
    }

    if name.starts_with('.') || name.ends_with('.') {
        return Some("Branch name cannot start or end with a dot".to_string());
    }

    if name.contains("..") {
        return Some("Branch name cannot contain consecutive dots".to_string());
    }

    if name.contains(' ') {
        return Some("Branch name cannot contain spaces".to_string());
    }

    if name.len() > 50 {
        return Some("Branch name is too long (max 50 characters)".to_string());
    }

    // .lock サフィックスの禁止（Gitの内部ファイルとの衝突回避）
    if name.ends_with(".lock") {
        return Some("Branch name cannot end with '.lock'".to_string());
    }

    // 連続スラッシュの禁止
    if name.contains("//") {
        return Some("Branch name cannot contain consecutive slashes".to_string());
    }

    // 末尾スラッシュの禁止
    if name.ends_with('/') {
        return Some("Branch name cannot end with '/'".to_string());
    }

    // 先頭スラッシュの禁止
    if name.starts_with('/') {
        return Some("Branch name cannot start with '/'".to_string());
    }

    None
}

/// ブランチ名をworktreeパス用にサニタイズ
///
/// スラッシュをハイフンに置換します。
///
/// # Example
/// ```ignore
/// assert_eq!(sanitize_branch_name("feature/user-auth"), "feature-user-auth");
/// ```
pub fn sanitize_branch_name(branch: &str) -> String {
    branch.replace('/', "-")
}

/// Worktreeパスのプレビューを生成
///
/// 入力されたブランチ名から、作成されるworktreeのパスを生成します。
///
/// # Returns
/// - `None`: ブランチ名が空の場合
/// - `Some(String)`: プレビューパス
pub fn generate_worktree_preview(branch_name: &str, config: &Config) -> Option<String> {
    let branch_name = branch_name.trim();
    if branch_name.is_empty() {
        return None;
    }

    let repo_name = get_repository_name();
    let sanitized_branch = sanitize_branch_name(branch_name);

    let base_path = config
        .expanded_worktree_base_path()
        .map(|p| p.display().to_string())
        .unwrap_or_else(|| config.worktree_base_path.clone());

    Some(format!("{}/{}/{}", base_path, repo_name, sanitized_branch))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_validate_branch_name_valid() {
        assert!(validate_branch_name("feature/test").is_none());
        assert!(validate_branch_name("fix-bug-123").is_none());
        assert!(validate_branch_name("v1.0.0").is_none());
        assert!(validate_branch_name("main").is_none());
        assert!(validate_branch_name("feature/user/auth").is_none());
    }

    #[test]
    fn test_validate_branch_name_empty() {
        assert!(validate_branch_name("").is_some());
        assert!(validate_branch_name("  ").is_some());
    }

    #[test]
    fn test_validate_branch_name_invalid_chars() {
        assert!(validate_branch_name("feature~test").is_some());
        assert!(validate_branch_name("branch^name").is_some());
        assert!(validate_branch_name("test:name").is_some());
        assert!(validate_branch_name("test?name").is_some());
        assert!(validate_branch_name("test*name").is_some());
        assert!(validate_branch_name("test[name").is_some());
        assert!(validate_branch_name("test]name").is_some());
        assert!(validate_branch_name("test\\name").is_some());
        assert!(validate_branch_name("test@name").is_some());
    }

    #[test]
    fn test_validate_branch_name_dots() {
        assert!(validate_branch_name(".hidden").is_some());
        assert!(validate_branch_name("hidden.").is_some());
        assert!(validate_branch_name("branch..name").is_some());
    }

    #[test]
    fn test_validate_branch_name_spaces() {
        assert!(validate_branch_name("with space").is_some());
        assert!(validate_branch_name("hello world").is_some());
    }

    #[test]
    fn test_validate_branch_name_too_long() {
        let long_name = "a".repeat(51);
        assert!(validate_branch_name(&long_name).is_some());

        let max_name = "a".repeat(50);
        assert!(validate_branch_name(&max_name).is_none());
    }

    #[test]
    fn test_validate_branch_name_lock_suffix() {
        assert!(validate_branch_name("branch.lock").is_some());
        assert!(validate_branch_name("feature/test.lock").is_some());
        // .lock が途中にある場合はOK
        assert!(validate_branch_name("test.lockfile").is_none());
    }

    #[test]
    fn test_validate_branch_name_slashes() {
        // 連続スラッシュは不可
        assert!(validate_branch_name("feature//test").is_some());
        // 末尾スラッシュは不可
        assert!(validate_branch_name("feature/test/").is_some());
        // 先頭スラッシュは不可
        assert!(validate_branch_name("/feature/test").is_some());
        // 正常なスラッシュはOK
        assert!(validate_branch_name("feature/test").is_none());
        assert!(validate_branch_name("feature/user/auth").is_none());
    }

    #[test]
    fn test_sanitize_branch_name() {
        assert_eq!(sanitize_branch_name("feature/test"), "feature-test");
        assert_eq!(sanitize_branch_name("fix/bug/123"), "fix-bug-123");
        assert_eq!(sanitize_branch_name("main"), "main");
        assert_eq!(sanitize_branch_name("no-slash"), "no-slash");
    }
}
