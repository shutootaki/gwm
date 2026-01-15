//! Hook execution logic.
//!
//! Runs post-create hooks in the worktree directory with appropriate environment variables.

use std::collections::HashMap;
use std::process::{Command, Stdio};

use super::types::{HookContext, HookResult};
use crate::config::Config;
use crate::error::Result;

/// Prepare environment variables for hook execution.
fn prepare_hook_env(context: &HookContext) -> HashMap<String, String> {
    let mut env: HashMap<String, String> = std::env::vars().collect();

    env.insert(
        "GWM_WORKTREE_PATH".to_string(),
        context.worktree_path.display().to_string(),
    );
    env.insert("GWM_BRANCH_NAME".to_string(), context.branch_name.clone());
    env.insert(
        "GWM_REPO_ROOT".to_string(),
        context.repo_root.display().to_string(),
    );
    env.insert("GWM_REPO_NAME".to_string(), context.repo_name.clone());

    env
}

/// Execute a single shell command.
fn execute_command(
    command: &str,
    cwd: &std::path::Path,
    env: &HashMap<String, String>,
) -> std::io::Result<i32> {
    let status = Command::new("sh")
        .args(["-c", command])
        .current_dir(cwd)
        .envs(env)
        .stdin(Stdio::inherit())
        .stdout(Stdio::inherit())
        .stderr(Stdio::inherit())
        .status()?;

    Ok(status.code().unwrap_or(1))
}

/// Run post_create hooks from configuration.
pub fn run_post_create_hooks(config: &Config, context: &HookContext) -> Result<HookResult> {
    let commands = match config.post_create_commands() {
        Some(cmds) if !cmds.is_empty() => cmds,
        _ => return Ok(HookResult::success(0)),
    };

    execute_hooks(commands, context)
}

/// Run post_create hooks with explicit command list.
///
/// Used by deferred hooks execution where commands are stored in
/// the hooks file rather than loaded from config.
pub fn run_post_create_hooks_with_commands(
    commands: &[String],
    context: &HookContext,
) -> Result<HookResult> {
    if commands.is_empty() {
        return Ok(HookResult::success(0));
    }

    execute_hooks(commands, context)
}

/// Execute hook commands in sequence.
fn execute_hooks(commands: &[String], context: &HookContext) -> Result<HookResult> {
    let env = prepare_hook_env(context);
    let total = commands.len();

    println!(
        "\n\x1b[36mRunning post_create hooks ({} command{})...\x1b[0m",
        total,
        if total > 1 { "s" } else { "" }
    );

    for (i, cmd) in commands.iter().enumerate() {
        println!("  [{}/{}] Executing: {}", i + 1, total, cmd);

        match execute_command(cmd, &context.worktree_path, &env) {
            Ok(0) => {
                println!(
                    "  \x1b[32m✓ [{}/{}] {} (completed)\x1b[0m",
                    i + 1,
                    total,
                    cmd
                );
            }
            Ok(code) => {
                println!(
                    "  \x1b[31m✗ [{}/{}] {} (failed, exit code: {})\x1b[0m",
                    i + 1,
                    total,
                    cmd,
                    code
                );
                return Ok(HookResult::failure(i + 1, cmd.clone(), code));
            }
            Err(e) => {
                println!(
                    "  \x1b[31m✗ [{}/{}] {} (error: {})\x1b[0m",
                    i + 1,
                    total,
                    cmd,
                    e
                );
                return Ok(HookResult::failure(i + 1, cmd.clone(), 1));
            }
        }
    }

    println!(
        "\x1b[32m✓ post_create hooks completed ({}/{})\x1b[0m",
        total, total
    );
    Ok(HookResult::success(total))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;
    use tempfile::TempDir;

    fn create_test_context() -> HookContext {
        HookContext {
            worktree_path: PathBuf::from("/path/to/worktree"),
            branch_name: "feature/test".to_string(),
            repo_root: PathBuf::from("/path/to/repo"),
            repo_name: "test-repo".to_string(),
        }
    }

    #[test]
    fn test_prepare_hook_env() {
        let context = create_test_context();
        let env = prepare_hook_env(&context);

        assert_eq!(env.get("GWM_WORKTREE_PATH").unwrap(), "/path/to/worktree");
        assert_eq!(env.get("GWM_BRANCH_NAME").unwrap(), "feature/test");
        assert_eq!(env.get("GWM_REPO_ROOT").unwrap(), "/path/to/repo");
        assert_eq!(env.get("GWM_REPO_NAME").unwrap(), "test-repo");
    }

    #[test]
    fn test_prepare_hook_env_inherits_system_env() {
        // 既存の環境変数を継承することを確認
        std::env::set_var("GWM_TEST_INHERIT", "test_value");

        let context = create_test_context();
        let env = prepare_hook_env(&context);

        assert_eq!(env.get("GWM_TEST_INHERIT").unwrap(), "test_value");

        std::env::remove_var("GWM_TEST_INHERIT");
    }

    #[test]
    fn test_run_hooks_no_commands() {
        let config = Config::default();
        let context = HookContext {
            worktree_path: PathBuf::from("/tmp"),
            branch_name: "test".to_string(),
            repo_root: PathBuf::from("/tmp"),
            repo_name: "test".to_string(),
        };

        let result = run_post_create_hooks(&config, &context).unwrap();
        assert!(result.success);
        assert_eq!(result.executed_count, 0);
    }

    #[test]
    fn test_run_post_create_hooks_with_commands_empty() {
        // 空のコマンドリスト → success(0)
        let temp_dir = TempDir::new().unwrap();
        let context = HookContext {
            worktree_path: temp_dir.path().to_path_buf(),
            branch_name: "test".to_string(),
            repo_root: temp_dir.path().to_path_buf(),
            repo_name: "test".to_string(),
        };

        let result = run_post_create_hooks_with_commands(&[], &context).unwrap();
        assert!(result.success);
        assert_eq!(result.executed_count, 0);
    }

    #[test]
    fn test_run_post_create_hooks_with_commands_success() {
        // コマンド実行成功
        let temp_dir = TempDir::new().unwrap();
        let context = HookContext {
            worktree_path: temp_dir.path().to_path_buf(),
            branch_name: "test".to_string(),
            repo_root: temp_dir.path().to_path_buf(),
            repo_name: "test".to_string(),
        };

        let commands = vec!["echo hello".to_string(), "echo world".to_string()];
        let result = run_post_create_hooks_with_commands(&commands, &context).unwrap();

        assert!(result.success);
        assert_eq!(result.executed_count, 2);
        assert!(result.failed_command.is_none());
    }

    #[test]
    fn test_run_post_create_hooks_with_commands_failure() {
        // コマンド実行失敗
        let temp_dir = TempDir::new().unwrap();
        let context = HookContext {
            worktree_path: temp_dir.path().to_path_buf(),
            branch_name: "test".to_string(),
            repo_root: temp_dir.path().to_path_buf(),
            repo_name: "test".to_string(),
        };

        let commands = vec![
            "echo first".to_string(),
            "exit 1".to_string(), // このコマンドは失敗する
            "echo third".to_string(),
        ];
        let result = run_post_create_hooks_with_commands(&commands, &context).unwrap();

        assert!(!result.success);
        assert_eq!(result.executed_count, 2); // 2番目で失敗
        assert_eq!(result.failed_command, Some("exit 1".to_string()));
        assert_eq!(result.exit_code, Some(1));
    }

    #[test]
    fn test_execute_command_success() {
        let temp_dir = TempDir::new().unwrap();
        let env: HashMap<String, String> = std::env::vars().collect();

        let result = execute_command("echo test", temp_dir.path(), &env);

        assert!(result.is_ok());
        assert_eq!(result.unwrap(), 0);
    }

    #[test]
    fn test_execute_command_failure() {
        let temp_dir = TempDir::new().unwrap();
        let env: HashMap<String, String> = std::env::vars().collect();

        let result = execute_command("exit 42", temp_dir.path(), &env);

        assert!(result.is_ok());
        assert_eq!(result.unwrap(), 42);
    }

    #[test]
    fn test_execute_command_with_gwm_env() {
        // GWM環境変数がコマンドに渡されることを確認
        let temp_dir = TempDir::new().unwrap();
        let test_file = temp_dir.path().join("output.txt");

        let context = HookContext {
            worktree_path: temp_dir.path().to_path_buf(),
            branch_name: "feature/test-branch".to_string(),
            repo_root: temp_dir.path().to_path_buf(),
            repo_name: "test-repo".to_string(),
        };

        let env = prepare_hook_env(&context);

        // 環境変数をファイルに書き込むコマンド
        let cmd = format!("echo $GWM_BRANCH_NAME > {}", test_file.display());
        let result = execute_command(&cmd, temp_dir.path(), &env);

        assert!(result.is_ok());
        assert_eq!(result.unwrap(), 0);

        let content = std::fs::read_to_string(&test_file).unwrap();
        assert_eq!(content.trim(), "feature/test-branch");
    }
}
