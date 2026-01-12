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

    // Add gwm-specific environment variables
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

/// Run post_create hooks.
///
/// Executes each command in sequence, stopping on the first failure.
///
/// # Arguments
///
/// * `config` - Configuration containing hook commands
/// * `context` - Hook execution context (paths, branch name, etc.)
///
/// # Returns
///
/// A `HookResult` indicating success or failure with details.
pub fn run_post_create_hooks(config: &Config, context: &HookContext) -> Result<HookResult> {
    let commands = match config.post_create_commands() {
        Some(cmds) if !cmds.is_empty() => cmds,
        _ => return Ok(HookResult::success(0)),
    };

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

    #[test]
    fn test_prepare_hook_env() {
        let context = HookContext {
            worktree_path: PathBuf::from("/path/to/worktree"),
            branch_name: "feature/test".to_string(),
            repo_root: PathBuf::from("/path/to/repo"),
            repo_name: "test-repo".to_string(),
        };

        let env = prepare_hook_env(&context);

        assert_eq!(env.get("GWM_WORKTREE_PATH").unwrap(), "/path/to/worktree");
        assert_eq!(env.get("GWM_BRANCH_NAME").unwrap(), "feature/test");
        assert_eq!(env.get("GWM_REPO_ROOT").unwrap(), "/path/to/repo");
        assert_eq!(env.get("GWM_REPO_NAME").unwrap(), "test-repo");
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
}
