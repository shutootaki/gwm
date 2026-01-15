//! Shell integration helpers for changing directories.
//!
//! When `GWM_CWD_FILE` is set, gwm will write a target directory path to the file
//! instead of printing it to stdout. A shell wrapper can then read the file and
//! `cd` into that directory without using command substitution (which breaks TUI).

use std::path::{Path, PathBuf};

const CWD_FILE_ENV: &str = "GWM_CWD_FILE";

/// Result of attempting to write the cwd file.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CwdWriteResult {
    /// Successfully wrote the target directory to the cwd file.
    Written,
    /// The `GWM_CWD_FILE` environment variable is not set.
    /// Caller should fall back to printing the path to stdout.
    EnvNotSet,
}

/// Get the cwd file path from environment.
pub fn cwd_file_path() -> Option<PathBuf> {
    std::env::var_os(CWD_FILE_ENV).map(PathBuf::from)
}

/// Write `target_dir` into the cwd file if `GWM_CWD_FILE` is set.
///
/// Returns `Ok(CwdWriteResult::Written)` when written,
/// `Ok(CwdWriteResult::EnvNotSet)` when the env var is not set.
pub fn try_write_cwd_file(target_dir: &Path) -> std::io::Result<CwdWriteResult> {
    let Some(file_path) = cwd_file_path() else {
        return Ok(CwdWriteResult::EnvNotSet);
    };

    let content = target_dir.to_string_lossy();
    std::fs::write(file_path, content.as_bytes())?;
    Ok(CwdWriteResult::Written)
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    #[test]
    fn test_try_write_cwd_file_env_not_set() {
        std::env::remove_var(CWD_FILE_ENV);
        let result = try_write_cwd_file(Path::new("/tmp")).unwrap();
        assert_eq!(result, CwdWriteResult::EnvNotSet);
    }

    #[test]
    fn test_try_write_cwd_file_success() {
        let temp_dir = TempDir::new().unwrap();
        let cwd_file = temp_dir.path().join("gwm-cwd");

        std::env::set_var(CWD_FILE_ENV, &cwd_file);

        let target_path = Path::new("/some/worktree/path");
        let result = try_write_cwd_file(target_path).unwrap();
        assert_eq!(result, CwdWriteResult::Written);

        let content = std::fs::read_to_string(&cwd_file).unwrap();
        assert_eq!(content, "/some/worktree/path");

        std::env::remove_var(CWD_FILE_ENV);
    }

    // Note: cwd_file_path() is tested indirectly through try_write_cwd_file_success
    // and test_try_write_cwd_file_env_not_set. Direct tests for cwd_file_path()
    // are omitted to avoid environment variable race conditions in parallel tests.
}
