//! File copying utilities for worktree creation.
//!
//! Provides functionality to copy gitignored files (like `.env`) from the source
//! worktree to newly created worktrees.
//!
//! # Overview
//!
//! When a new worktree is created, certain files that are gitignored should be
//! copied from the main worktree to ensure the development environment works
//! correctly. Common examples include:
//!
//! - `.env` files with environment variables
//! - `.env.local` files with local overrides
//!
//! # Configuration
//!
//! The copy behavior is configured in `config.toml`:
//!
//! ```toml
//! [copy_ignored_files]
//! enabled = true
//! patterns = [".env", ".env.*", ".env.local", ".env.*.local"]
//! exclude_patterns = [".env.example", ".env.sample"]
//! ```
//!
//! # Pattern Matching
//!
//! - `patterns`: Glob patterns for files to include. **If empty, all gitignored
//!   files in the worktree will be considered as copy candidates** (determined
//!   by `git check-ignore`).
//! - `exclude_patterns`: Glob patterns for files to exclude (takes precedence)
//!
//! # Differences from TypeScript version
//!
//! In the TypeScript version, if both `patterns` and `exclude_patterns` are empty,
//! no files are copied. In this Rust version, if `patterns` is empty, all gitignored
//! files are copied (minus any `exclude_patterns`).

use std::collections::HashSet;
use std::fs;
use std::io::Write as _;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};

use glob::Pattern;
use walkdir::WalkDir;

use crate::config::CopyIgnoredFilesConfig;
use crate::error::Result;

/// ディレクトリを再帰的にコピーする
///
/// # Arguments
///
/// * `source` - コピー元ディレクトリのパス
/// * `target` - コピー先ディレクトリのパス
///
/// # Returns
///
/// コピーされたファイル数
fn copy_dir_recursive(source: &Path, target: &Path) -> std::io::Result<u64> {
    fs::create_dir_all(target)?;
    let mut count = 0;
    for entry in fs::read_dir(source)? {
        let entry = entry?;
        let source_path = entry.path();
        let target_path = target.join(entry.file_name());

        // シンボリックリンクは明示的にスキップ（循環参照防止）
        if source_path.is_symlink() {
            continue;
        }

        if source_path.is_dir() {
            count += copy_dir_recursive(&source_path, &target_path)?;
        } else if source_path.is_file() {
            fs::copy(&source_path, &target_path)?;
            count += 1;
        }
    }
    Ok(count)
}

/// ワークツリー内の gitignore されたファイルを取得する
///
/// # Arguments
///
/// * `worktree` - ワークツリーのパス
///
/// # Returns
///
/// gitignore されたファイルのパスの集合
///
/// # Errors
///
/// - ワークツリーが git リポジトリでない場合
/// - `git check-ignore` コマンドの実行に失敗した場合
/// - ディレクトリの走査中にエラーが発生した場合（警告のみ出力し継続）
fn get_gitignored_files(worktree: &Path) -> Result<HashSet<PathBuf>> {
    let mut ignored_files = HashSet::new();

    // ワークツリー内の全ファイルを再帰的に列挙
    let all_paths: Vec<PathBuf> = WalkDir::new(worktree)
        .into_iter()
        .filter_map(|entry_result| match entry_result {
            Ok(entry) => Some(entry),
            Err(err) => {
                eprintln!("Warning: Error walking directory: {}", err);
                None
            }
        })
        .filter(|e| e.path() != worktree) // ルート自体はスキップ
        .filter(|e| !e.path().to_string_lossy().contains("/.git/")) // .git ディレクトリはスキップ
        .filter(|e| e.file_type().is_file() || e.file_type().is_dir())
        .map(|e| e.path().to_path_buf())
        .collect();

    if all_paths.is_empty() {
        return Ok(ignored_files);
    }

    // git check-ignore --stdin -z を使って gitignore されたファイルを判定
    let mut child = Command::new("git")
        .args([
            "-C",
            &worktree.to_string_lossy(),
            "check-ignore",
            "--stdin",
            "-z",
        ])
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()?;

    // 全パスを stdin に書き込む（NUL区切り）
    if let Some(mut stdin) = child.stdin.take() {
        for path in &all_paths {
            if let Ok(relative) = path.strip_prefix(worktree) {
                if let Err(e) = stdin.write_all(relative.to_string_lossy().as_bytes()) {
                    eprintln!("Warning: Failed to write path to git check-ignore: {}", e);
                    continue;
                }
                if let Err(e) = stdin.write_all(b"\0") {
                    eprintln!(
                        "Warning: Failed to write null byte to git check-ignore: {}",
                        e
                    );
                }
            }
        }
    }

    let output = child.wait_with_output()?;

    // git check-ignore の終了コード:
    // - 0: 少なくとも1つのパスが無視された
    // - 1: どのパスも無視されなかった（正常）
    // - 128: not a git repository（空の結果を返す）
    // - その他: エラー
    if !output.status.success() {
        let exit_code = output.status.code();
        // exit code 1 は「無視されたファイルなし」を意味するので正常
        if exit_code != Some(1) {
            // exit code 128 は「not a git repository」を意味する
            // この場合は gitignore されたファイルがないため、空の結果を返す
            if exit_code == Some(128) {
                return Ok(ignored_files);
            }

            let stderr = String::from_utf8_lossy(&output.stderr);
            if !stderr.is_empty() {
                eprintln!("Warning: git check-ignore stderr: {}", stderr.trim());
            }
            // 致命的なエラーの場合はエラーを返す
            if exit_code.is_some() && exit_code != Some(0) && exit_code != Some(1) {
                return Err(crate::error::GwmError::git_command(format!(
                    "git check-ignore failed with exit code {:?}: {}",
                    exit_code,
                    stderr.trim()
                )));
            }
        }
    }

    // 出力をパース（NUL区切り）
    let stdout = String::from_utf8_lossy(&output.stdout);
    for ignored_path in stdout.split('\0') {
        if !ignored_path.is_empty() {
            ignored_files.insert(worktree.join(ignored_path));
        }
    }

    Ok(ignored_files)
}

/// Result of copying gitignored files.
#[derive(Debug, Default)]
pub struct CopyResult {
    /// Files that were successfully copied.
    pub copied: Vec<String>,
    /// Files that were skipped due to exclude patterns.
    pub skipped: Vec<String>,
    /// Files that already existed in target (not overwritten).
    pub existing: Vec<String>,
    /// Files that failed to copy (with error messages).
    pub failed: Vec<(String, String)>,
}

impl CopyResult {
    /// Returns true if any files were copied.
    pub fn has_copied(&self) -> bool {
        !self.copied.is_empty()
    }

    /// Returns true if any files failed to copy.
    pub fn has_failed(&self) -> bool {
        !self.failed.is_empty()
    }

    /// Returns a summary message for display.
    pub fn summary(&self) -> String {
        let mut parts = Vec::new();

        if !self.copied.is_empty() {
            parts.push(format!(
                "Copied {} file(s): {}",
                self.copied.len(),
                self.copied.join(", ")
            ));
        }

        if !self.failed.is_empty() {
            let failed_names: Vec<_> = self.failed.iter().map(|(name, _)| name.as_str()).collect();
            parts.push(format!(
                "Failed {} file(s): {}",
                self.failed.len(),
                failed_names.join(", ")
            ));
        }

        if parts.is_empty() {
            "No files copied".to_string()
        } else {
            parts.join("; ")
        }
    }
}

/// Copy gitignored files from source worktree to target worktree.
///
/// # Arguments
///
/// * `source_worktree` - Path to the source worktree (usually the main worktree)
/// * `target_worktree` - Path to the newly created worktree
/// * `config` - Configuration for which files to copy
///
/// # Returns
///
/// A `CopyResult` containing information about copied and skipped files.
///
/// # Example
///
/// ```ignore
/// use gwm::utils::copy::copy_ignored_files;
/// use gwm::config::CopyIgnoredFilesConfig;
///
/// let config = CopyIgnoredFilesConfig::default();
/// let result = copy_ignored_files(
///     Path::new("/path/to/main"),
///     Path::new("/path/to/new-worktree"),
///     &config,
/// )?;
///
/// for file in &result.copied {
///     println!("Copied: {}", file);
/// }
/// ```
pub fn copy_ignored_files(
    source_worktree: &Path,
    target_worktree: &Path,
    config: &CopyIgnoredFilesConfig,
) -> Result<CopyResult> {
    // If copying is disabled, return empty result
    if !config.enabled {
        return Ok(CopyResult::default());
    }

    let mut result = CopyResult::default();

    // Compile exclude patterns for filtering
    let exclude_patterns: Vec<Pattern> = config
        .exclude_patterns
        .iter()
        .filter_map(|p| match Pattern::new(p) {
            Ok(pattern) => Some(pattern),
            Err(e) => {
                eprintln!("Warning: Invalid exclude pattern '{}': {}", p, e);
                None
            }
        })
        .collect();

    // Use glob to find matching files/directories
    let mut matched_paths: HashSet<PathBuf> = HashSet::new();

    if config.patterns.is_empty() {
        // patterns が空の場合: gitignore されたファイルのみを対象
        matched_paths = get_gitignored_files(source_worktree)?;
    } else {
        // patterns が指定されている場合: glob でマッチするものを対象
        for pattern in &config.patterns {
            let full_pattern = source_worktree.join(pattern);
            let pattern_str = full_pattern.to_string_lossy();

            match glob::glob(&pattern_str) {
                Ok(paths) => {
                    for entry in paths.flatten() {
                        matched_paths.insert(entry);
                    }
                }
                Err(e) => {
                    eprintln!("Warning: Invalid glob pattern '{}': {}", pattern, e);
                }
            }
        }
    }

    // Process matched paths
    for source_path in matched_paths {
        // Get relative path from source_worktree
        let relative_path = match source_path.strip_prefix(source_worktree) {
            Ok(p) => p,
            Err(e) => {
                eprintln!(
                    "Warning: Failed to get relative path for '{}': {}",
                    source_path.display(),
                    e
                );
                continue;
            }
        };
        let relative_str = relative_path.to_string_lossy().to_string();

        // Check if matches any exclude pattern
        let matches_exclude = exclude_patterns.iter().any(|p| p.matches(&relative_str));
        if matches_exclude {
            result.skipped.push(relative_str);
            continue;
        }

        let target_path = target_worktree.join(relative_path);

        // Check if target already exists
        if target_path.exists() {
            result.existing.push(relative_str);
            continue;
        }

        // Ensure parent directory exists
        if let Some(parent) = target_path.parent() {
            if !parent.exists() {
                if let Err(e) = fs::create_dir_all(parent) {
                    result.failed.push((relative_str, e.to_string()));
                    continue;
                }
            }
        }

        if source_path.is_dir() {
            // ディレクトリの場合は再帰的にコピー
            match copy_dir_recursive(&source_path, &target_path) {
                Ok(count) => {
                    result
                        .copied
                        .push(format!("{}/ ({} files)", relative_str, count));
                }
                Err(e) => {
                    result.failed.push((relative_str, e.to_string()));
                }
            }
        } else if source_path.is_file() {
            // ファイルの場合は通常コピー
            match fs::copy(&source_path, &target_path) {
                Ok(_) => result.copied.push(relative_str),
                Err(e) => result.failed.push((relative_str, e.to_string())),
            }
        }
        // シンボリックリンク等はスキップ
    }

    Ok(result)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs::File;
    use std::io::Write;
    use std::process::Command;
    use tempfile::TempDir;

    fn create_test_config() -> CopyIgnoredFilesConfig {
        CopyIgnoredFilesConfig {
            enabled: true,
            patterns: vec![".env".to_string(), ".env.*".to_string()],
            exclude_patterns: vec![".env.example".to_string(), ".env.sample".to_string()],
        }
    }

    /// テスト用のgitリポジトリを初期化する
    fn init_git_repo(path: &Path) {
        Command::new("git")
            .args(["init"])
            .current_dir(path)
            .output()
            .expect("Failed to init git repo");

        // 最小限のgit設定
        Command::new("git")
            .args(["config", "user.email", "test@example.com"])
            .current_dir(path)
            .output()
            .ok();
        Command::new("git")
            .args(["config", "user.name", "Test User"])
            .current_dir(path)
            .output()
            .ok();
    }

    /// .gitignore ファイルを作成する
    fn create_gitignore(path: &Path, patterns: &[&str]) {
        let gitignore_path = path.join(".gitignore");
        let mut file = File::create(gitignore_path).expect("Failed to create .gitignore");
        for pattern in patterns {
            writeln!(file, "{}", pattern).expect("Failed to write .gitignore");
        }
    }

    #[test]
    fn test_copy_env_file() {
        let source = TempDir::new().unwrap();
        let target = TempDir::new().unwrap();

        // Create .env file in source
        let env_path = source.path().join(".env");
        let mut file = File::create(env_path).unwrap();
        writeln!(file, "API_KEY=secret").unwrap();

        let config = create_test_config();
        let result = copy_ignored_files(source.path(), target.path(), &config).unwrap();

        assert_eq!(result.copied, vec![".env"]);
        assert!(target.path().join(".env").exists());

        // Verify content was copied correctly
        let content = fs::read_to_string(target.path().join(".env")).unwrap();
        assert!(content.contains("API_KEY=secret"));
    }

    #[test]
    fn test_skip_excluded_files() {
        let source = TempDir::new().unwrap();
        let target = TempDir::new().unwrap();

        // Create .env.example in source (should be excluded)
        File::create(source.path().join(".env.example")).unwrap();

        let config = create_test_config();
        let result = copy_ignored_files(source.path(), target.path(), &config).unwrap();

        assert!(result.copied.is_empty());
        assert_eq!(result.skipped, vec![".env.example"]);
        assert!(!target.path().join(".env.example").exists());
    }

    #[test]
    fn test_skip_existing_files() {
        let source = TempDir::new().unwrap();
        let target = TempDir::new().unwrap();

        // Create .env in both source and target
        File::create(source.path().join(".env")).unwrap();
        File::create(target.path().join(".env")).unwrap();

        let config = create_test_config();
        let result = copy_ignored_files(source.path(), target.path(), &config).unwrap();

        assert!(result.copied.is_empty());
        assert_eq!(result.existing, vec![".env"]);
    }

    #[test]
    fn test_disabled_config() {
        let source = TempDir::new().unwrap();
        let target = TempDir::new().unwrap();

        File::create(source.path().join(".env")).unwrap();

        let config = CopyIgnoredFilesConfig {
            enabled: false,
            patterns: vec![".env".to_string()],
            exclude_patterns: vec![],
        };

        let result = copy_ignored_files(source.path(), target.path(), &config).unwrap();

        assert!(result.copied.is_empty());
        assert!(!target.path().join(".env").exists());
    }

    #[test]
    fn test_multiple_env_files() {
        let source = TempDir::new().unwrap();
        let target = TempDir::new().unwrap();

        // Create multiple .env files
        File::create(source.path().join(".env")).unwrap();
        File::create(source.path().join(".env.local")).unwrap();
        File::create(source.path().join(".env.development")).unwrap();
        File::create(source.path().join(".env.example")).unwrap(); // excluded

        let config = create_test_config();
        let result = copy_ignored_files(source.path(), target.path(), &config).unwrap();

        assert_eq!(result.copied.len(), 3);
        assert!(result.copied.contains(&".env".to_string()));
        assert!(result.copied.contains(&".env.local".to_string()));
        assert!(result.copied.contains(&".env.development".to_string()));
        assert_eq!(result.skipped, vec![".env.example"]);
    }

    #[test]
    fn test_copy_result_summary() {
        let mut result = CopyResult::default();
        assert_eq!(result.summary(), "No files copied");

        result.copied = vec![".env".to_string(), ".env.local".to_string()];
        assert_eq!(result.summary(), "Copied 2 file(s): .env, .env.local");
    }

    /// exclude_patternsのみ設定時（patternsが空）のテスト
    /// patternsが空の場合は gitignore されたファイルを対象とし、exclude_patternsで除外する
    #[test]
    fn test_exclude_patterns_only() {
        let source = TempDir::new().unwrap();
        let target = TempDir::new().unwrap();

        // git リポジトリを初期化
        init_git_repo(source.path());

        // .gitignore を作成（.env*, config.json を無視）
        create_gitignore(source.path(), &[".env*", "config.json"]);

        // Create multiple files in source
        File::create(source.path().join(".env")).unwrap();
        File::create(source.path().join(".env.local")).unwrap();
        File::create(source.path().join(".env.example")).unwrap();
        File::create(source.path().join("config.json")).unwrap();
        File::create(source.path().join("tracked.txt")).unwrap(); // git管理対象

        // patterns is empty → gitignored ファイルが対象
        // exclude_patterns で .env.example を除外
        let config = CopyIgnoredFilesConfig {
            enabled: true,
            patterns: vec![], // empty → gitignored ファイルが対象
            exclude_patterns: vec![".env.example".to_string()],
        };

        let result = copy_ignored_files(source.path(), target.path(), &config).unwrap();

        // gitignored ファイルのうち、exclude で除外されていないものがコピーされる
        assert!(result.copied.contains(&".env".to_string()));
        assert!(result.copied.contains(&".env.local".to_string()));
        assert!(result.copied.contains(&"config.json".to_string()));
        // .env.example は exclude で除外
        assert!(result.skipped.contains(&".env.example".to_string()));
        // tracked.txt は gitignored ではないのでコピーされない
        assert!(!result.copied.contains(&"tracked.txt".to_string()));
    }

    /// patternsとexclude_patternsの両方が空の場合は gitignored ファイル全部をコピー
    #[test]
    fn test_empty_patterns_and_exclude_patterns() {
        let source = TempDir::new().unwrap();
        let target = TempDir::new().unwrap();

        // git リポジトリを初期化
        init_git_repo(source.path());

        // .gitignore を作成（.env のみ無視）
        create_gitignore(source.path(), &[".env"]);

        // Create files in source
        File::create(source.path().join(".env")).unwrap();
        File::create(source.path().join("config.json")).unwrap(); // git管理対象

        // Both patterns and exclude_patterns are empty → gitignored ファイル全部がコピー対象
        let config = CopyIgnoredFilesConfig {
            enabled: true,
            patterns: vec![],
            exclude_patterns: vec![],
        };

        let result = copy_ignored_files(source.path(), target.path(), &config).unwrap();

        // gitignored ファイル (.env) のみコピーされる
        assert!(result.copied.contains(&".env".to_string()));
        // config.json は gitignored ではないのでコピーされない
        assert!(!result.copied.contains(&"config.json".to_string()));
    }

    /// ディレクトリを再帰的にコピーするテスト
    #[test]
    fn test_copy_directory() {
        let source = TempDir::new().unwrap();
        let target = TempDir::new().unwrap();

        // ディレクトリ構造を作成
        let docs_dir = source.path().join(".local_docs");
        fs::create_dir(&docs_dir).unwrap();
        let mut file = File::create(docs_dir.join("note.md")).unwrap();
        writeln!(file, "# Test Note").unwrap();

        // サブディレクトリも作成
        let sub_dir = docs_dir.join("sub");
        fs::create_dir(&sub_dir).unwrap();
        File::create(sub_dir.join("nested.txt")).unwrap();

        let config = CopyIgnoredFilesConfig {
            enabled: true,
            patterns: vec![".local_docs".to_string()],
            exclude_patterns: vec![],
        };

        let result = copy_ignored_files(source.path(), target.path(), &config).unwrap();

        // ディレクトリがコピーされたことを確認
        assert_eq!(result.copied.len(), 1);
        assert!(result.copied[0].starts_with(".local_docs/"));
        assert!(result.copied[0].contains("2 files")); // note.md と nested.txt

        // ファイルが存在することを確認
        assert!(target.path().join(".local_docs").exists());
        assert!(target.path().join(".local_docs").is_dir());
        assert!(target.path().join(".local_docs/note.md").exists());
        assert!(target.path().join(".local_docs/sub/nested.txt").exists());

        // 内容が正しくコピーされたことを確認
        let content = fs::read_to_string(target.path().join(".local_docs/note.md")).unwrap();
        assert!(content.contains("# Test Note"));
    }

    /// 既存ディレクトリはスキップされるテスト
    #[test]
    fn test_skip_existing_directory() {
        let source = TempDir::new().unwrap();
        let target = TempDir::new().unwrap();

        // ソースにディレクトリを作成
        let docs_dir = source.path().join(".local_docs");
        fs::create_dir(&docs_dir).unwrap();
        File::create(docs_dir.join("note.md")).unwrap();

        // ターゲットに同名ディレクトリを作成
        fs::create_dir(target.path().join(".local_docs")).unwrap();

        let config = CopyIgnoredFilesConfig {
            enabled: true,
            patterns: vec![".local_docs".to_string()],
            exclude_patterns: vec![],
        };

        let result = copy_ignored_files(source.path(), target.path(), &config).unwrap();

        // 既存としてスキップされる
        assert!(result.copied.is_empty());
        assert_eq!(result.existing, vec![".local_docs"]);
    }

    /// ファイルとディレクトリの混在テスト
    #[test]
    fn test_copy_files_and_directories() {
        let source = TempDir::new().unwrap();
        let target = TempDir::new().unwrap();

        // ファイルを作成
        File::create(source.path().join(".env")).unwrap();

        // ディレクトリを作成
        let docs_dir = source.path().join(".local_docs");
        fs::create_dir(&docs_dir).unwrap();
        File::create(docs_dir.join("note.md")).unwrap();

        let config = CopyIgnoredFilesConfig {
            enabled: true,
            patterns: vec![".env".to_string(), ".local_docs".to_string()],
            exclude_patterns: vec![],
        };

        let result = copy_ignored_files(source.path(), target.path(), &config).unwrap();

        // ファイルとディレクトリの両方がコピーされる
        assert_eq!(result.copied.len(), 2);
        assert!(result.copied.contains(&".env".to_string()));
        assert!(result.copied.iter().any(|s| s.starts_with(".local_docs/")));

        // ファイルが存在することを確認
        assert!(target.path().join(".env").exists());
        assert!(target.path().join(".local_docs/note.md").exists());
    }

    /// サブディレクトリ内のファイル/ディレクトリをパスパターンでコピーするテスト
    #[test]
    fn test_copy_subdirectory_path_pattern() {
        let source = TempDir::new().unwrap();
        let target = TempDir::new().unwrap();

        // サブディレクトリ構造を作成 (gwm-rust/.003_local_temp_docs のようなケース)
        let subdir = source.path().join("subproject");
        fs::create_dir(&subdir).unwrap();
        let docs_dir = subdir.join(".local_docs");
        fs::create_dir(&docs_dir).unwrap();
        let mut file = File::create(docs_dir.join("note.md")).unwrap();
        writeln!(file, "# Nested Note").unwrap();

        // パスを含むパターンでコピー
        let config = CopyIgnoredFilesConfig {
            enabled: true,
            patterns: vec!["subproject/.local_docs".to_string()],
            exclude_patterns: vec![],
        };

        let result = copy_ignored_files(source.path(), target.path(), &config).unwrap();

        // サブディレクトリ内のディレクトリがコピーされる
        assert_eq!(result.copied.len(), 1);
        assert!(result.copied[0].contains(".local_docs"));

        // ファイルが存在することを確認
        assert!(target.path().join("subproject/.local_docs").exists());
        assert!(target
            .path()
            .join("subproject/.local_docs/note.md")
            .exists());

        // 内容が正しくコピーされたことを確認
        let content =
            fs::read_to_string(target.path().join("subproject/.local_docs/note.md")).unwrap();
        assert!(content.contains("# Nested Note"));
    }

    /// glob パターン (**) を使ったテスト
    #[test]
    fn test_copy_with_glob_pattern() {
        let source = TempDir::new().unwrap();
        let target = TempDir::new().unwrap();

        // 複数階層のディレクトリ構造を作成
        let dir1 = source.path().join("dir1");
        fs::create_dir(&dir1).unwrap();
        File::create(dir1.join(".env")).unwrap();

        let dir2 = source.path().join("dir2");
        fs::create_dir(&dir2).unwrap();
        File::create(dir2.join(".env")).unwrap();

        // ルートにも .env を作成
        File::create(source.path().join(".env")).unwrap();

        // **/.env パターンでコピー (ルートの .env は含まれない)
        let config = CopyIgnoredFilesConfig {
            enabled: true,
            patterns: vec!["**/.env".to_string()],
            exclude_patterns: vec![],
        };

        let result = copy_ignored_files(source.path(), target.path(), &config).unwrap();

        // サブディレクトリの .env がコピーされる
        assert!(result.copied.len() >= 2);
        assert!(target.path().join("dir1/.env").exists());
        assert!(target.path().join("dir2/.env").exists());
    }

    /// patterns が空の場合、サブディレクトリ内の gitignored ファイルもコピーされる
    #[test]
    fn test_patterns_empty_copies_nested_gitignored_files() {
        let source = TempDir::new().unwrap();
        let target = TempDir::new().unwrap();

        // git リポジトリを初期化
        init_git_repo(source.path());

        // サブディレクトリを作成
        let subdir = source.path().join("config");
        fs::create_dir(&subdir).unwrap();

        // .gitignore を作成（.env* を無視）
        create_gitignore(source.path(), &[".env*"]);

        // ルートと サブディレクトリに .env を作成
        File::create(source.path().join(".env")).unwrap();
        File::create(subdir.join(".env.local")).unwrap();

        let config = CopyIgnoredFilesConfig {
            enabled: true,
            patterns: vec![], // empty → gitignored ファイルが対象
            exclude_patterns: vec![],
        };

        let result = copy_ignored_files(source.path(), target.path(), &config).unwrap();

        // ルートとサブディレクトリの両方の gitignored ファイルがコピーされる
        assert!(result.copied.contains(&".env".to_string()));
        assert!(result.copied.contains(&"config/.env.local".to_string()));
    }

    /// 非gitリポジトリの場合、patterns が空なら何もコピーしない
    #[test]
    fn test_patterns_empty_in_non_git_repo() {
        let source = TempDir::new().unwrap();
        let target = TempDir::new().unwrap();

        // git リポジトリを初期化しない（非gitリポジトリ）

        // ファイルを作成
        File::create(source.path().join(".env")).unwrap();
        File::create(source.path().join("config.json")).unwrap();

        let config = CopyIgnoredFilesConfig {
            enabled: true,
            patterns: vec![], // empty → gitignored ファイルが対象だが、git repo ではない
            exclude_patterns: vec![],
        };

        let result = copy_ignored_files(source.path(), target.path(), &config).unwrap();

        // 非gitリポジトリなので gitignored ファイルはない → 何もコピーされない
        assert!(result.copied.is_empty());
    }
}
