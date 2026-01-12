//! Git基本操作ユーティリティ
//!
//! Gitリポジトリの判定やメタデータ取得のための関数群を提供します。

use std::path::{Path, PathBuf};

use crate::shell::{exec, exec_silent};

/// GitリモートURLからリポジトリ名を抽出
///
/// # サポートするURL形式
/// - HTTPS: `https://github.com/user/repo.git` → `repo`
/// - SSH: `git@github.com:user/repo.git` → `repo`
/// - `.git` サフィックスなし: `https://github.com/user/repo` → `repo`
///
/// URLの最後のセグメント（`/` の後）から `.git` サフィックスを除去して取得します。
///
/// # Returns
/// * `Some(String)`: 抽出されたリポジトリ名
/// * `None`: 抽出に失敗した場合
pub fn parse_repo_name_from_url(url: &str) -> Option<String> {
    // SSH形式の場合: git@github.com:user/repo.git
    // `:` の後を `/` に変換して統一処理
    let normalized = if url.contains(':') && !url.contains("://") {
        url.replace(':', "/")
    } else {
        url.to_string()
    };

    // 最後の `/` 以降を取得し、`.git` サフィックスを除去
    normalized
        .rsplit('/')
        .next()
        .map(|segment| segment.trim_end_matches(".git").to_string())
        .filter(|s| !s.is_empty())
}

/// 現在のディレクトリがGitリポジトリ内かどうかを判定
///
/// `git rev-parse --git-dir` の終了コードで判定します。
///
/// # Returns
/// * `true`: Gitリポジトリ内
/// * `false`: Gitリポジトリ外
pub fn is_git_repository() -> bool {
    exec_silent("git", &["rev-parse", "--git-dir"], None).is_ok()
}

/// 指定パスがGitリポジトリ内かどうかを判定
///
/// # Arguments
/// * `path` - 判定するディレクトリパス
///
/// # Returns
/// * `true`: Gitリポジトリ内
/// * `false`: Gitリポジトリ外
pub fn is_git_repository_at(path: &Path) -> bool {
    exec_silent("git", &["rev-parse", "--git-dir"], Some(path)).is_ok()
}

/// Gitリポジトリ名を取得
///
/// # 優先順位
/// 1. `git remote get-url origin` からリポジトリ名を抽出
/// 2. フォールバック: カレントディレクトリ名
pub fn get_repository_name() -> String {
    if let Ok(remote_url) = exec("git", &["remote", "get-url", "origin"], None) {
        if let Some(name) = parse_repo_name_from_url(remote_url.trim()) {
            return name;
        }
    }

    // フォールバック: カレントディレクトリ名
    std::env::current_dir()
        .ok()
        .and_then(|p| p.file_name().map(|s| s.to_string_lossy().to_string()))
        .unwrap_or_else(|| "unknown".to_string())
}

/// Gitリポジトリのルートディレクトリを取得
///
/// # Returns
/// * `Some(PathBuf)`: リポジトリルートのパス
/// * `None`: Gitリポジトリ外の場合
pub fn get_repo_root() -> Option<PathBuf> {
    exec("git", &["rev-parse", "--show-toplevel"], None)
        .ok()
        .map(|s| PathBuf::from(s.trim()))
}

/// 指定パスからGitリポジトリのルートディレクトリを取得
///
/// # Arguments
/// * `path` - 検索開始ディレクトリ
///
/// # Returns
/// * `Some(PathBuf)`: リポジトリルートのパス
/// * `None`: Gitリポジトリ外の場合
pub fn get_repo_root_at(path: &Path) -> Option<PathBuf> {
    exec("git", &["rev-parse", "--show-toplevel"], Some(path))
        .ok()
        .map(|s| PathBuf::from(s.trim()))
}

/// ローカルブランチが存在するか確認
///
/// `git show-ref --verify --quiet refs/heads/<branch>` で確認します。
///
/// # Arguments
/// * `branch` - ブランチ名（refs/heads/ プレフィックスなし）
///
/// # Returns
/// * `true`: ローカルブランチが存在する
/// * `false`: ローカルブランチが存在しない
///
/// # Example
/// ```ignore
/// if local_branch_exists("feature/test") {
///     println!("Branch exists locally");
/// }
/// ```
pub fn local_branch_exists(branch: &str) -> bool {
    let ref_path = format!("refs/heads/{}", branch);
    exec_silent("git", &["show-ref", "--verify", "--quiet", &ref_path], None).is_ok()
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::process::Command;
    use tempfile::TempDir;

    /// テスト用のGitリポジトリを作成
    fn create_test_repo() -> TempDir {
        let temp = TempDir::new().unwrap();
        Command::new("git")
            .args(["init"])
            .current_dir(temp.path())
            .output()
            .unwrap();
        temp
    }

    #[test]
    fn test_is_git_repository_in_repo() {
        let temp = create_test_repo();
        assert!(is_git_repository_at(temp.path()));
    }

    #[test]
    fn test_is_git_repository_not_repo() {
        let temp = TempDir::new().unwrap();
        assert!(!is_git_repository_at(temp.path()));
    }

    #[test]
    fn test_get_repo_root_at_in_repo() {
        let temp = create_test_repo();
        // get_repo_root_atを使用して並列テスト安全性を確保
        let root = get_repo_root_at(temp.path());
        assert!(root.is_some());
        assert_eq!(
            root.unwrap().canonicalize().unwrap(),
            temp.path().canonicalize().unwrap()
        );
    }

    #[test]
    fn test_get_repo_root_at_not_repo() {
        let temp = TempDir::new().unwrap();
        // Gitリポジトリでないディレクトリ
        let root = get_repo_root_at(temp.path());
        assert!(root.is_none());
    }

    #[test]
    fn test_parse_repo_name_from_url_https() {
        let url = "https://github.com/user/repo.git";
        assert_eq!(parse_repo_name_from_url(url), Some("repo".to_string()));
    }

    #[test]
    fn test_parse_repo_name_from_url_ssh() {
        let url = "git@github.com:user/repo.git";
        assert_eq!(parse_repo_name_from_url(url), Some("repo".to_string()));
    }

    #[test]
    fn test_parse_repo_name_from_url_without_git_suffix() {
        let url = "https://github.com/user/repo";
        assert_eq!(parse_repo_name_from_url(url), Some("repo".to_string()));
    }

    #[test]
    fn test_parse_repo_name_from_url_empty() {
        assert_eq!(parse_repo_name_from_url(""), None);
    }

    #[test]
    fn test_parse_repo_name_from_url_only_git_suffix() {
        // エッジケース: .git のみの場合
        assert_eq!(parse_repo_name_from_url("https://example.com/.git"), None);
    }
}
