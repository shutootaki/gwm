//! Configuration file loading and merging.
//!
//! Supports two configuration levels:
//! 1. Global: ~/.config/gwm/config.toml or ~/.gwmrc
//! 2. Project: <repo-root>/.gwm/config.toml (fallback: gwm/config.toml)

use std::fs;
use std::path::{Path, PathBuf};

use crate::error::{GwmError, Result};

use super::merger::merge_configs;
use super::types::Config;

/// Global configuration file paths (in order of priority).
const GLOBAL_CONFIG_PATHS: &[&str] = &[".config/gwm/config.toml", ".gwmrc"];

/// Project-level configuration directories (in order of priority).
/// .gwm/ is preferred, gwm/ is fallback for backward compatibility.
const PROJECT_CONFIG_DIRS: &[&str] = &[".gwm", "gwm"];

/// Result of loading configuration with source information.
#[derive(Debug)]
pub struct ConfigWithSource {
    /// The merged configuration
    pub config: Config,
    /// Path to the global config file (if found)
    pub global_config_path: Option<PathBuf>,
    /// Path to the project config file (if found)
    pub project_config_path: Option<PathBuf>,
    /// Whether the project config has hooks defined
    pub has_project_hooks: bool,
    /// Repository root path (if found)
    pub repo_root: Option<PathBuf>,
}

/// Find the global configuration file.
fn find_global_config() -> Option<PathBuf> {
    let home = dirs::home_dir()?;

    for relative_path in GLOBAL_CONFIG_PATHS {
        let path = home.join(relative_path);
        if path.exists() {
            return Some(path);
        }
    }

    None
}

/// Find the project configuration file.
/// Searches .gwm/config.toml first, falls back to gwm/config.toml for backward compatibility.
fn find_project_config(repo_root: &Path) -> Option<PathBuf> {
    for dir in PROJECT_CONFIG_DIRS {
        let path = repo_root.join(dir).join("config.toml");
        if path.exists() {
            return Some(path);
        }
    }
    None
}

/// Find the Git repository root from the current directory.
pub fn find_repo_root() -> Option<PathBuf> {
    let current = std::env::current_dir().ok()?;
    find_repo_root_from(&current)
}

/// Find the Git repository root from a given path.
pub fn find_repo_root_from(start: &Path) -> Option<PathBuf> {
    let mut current = start.to_path_buf();

    loop {
        if current.join(".git").exists() {
            return Some(current);
        }

        if !current.pop() {
            return None;
        }
    }
}

/// Load configuration from a TOML file.
fn load_config_from_file(path: &Path) -> Result<Config> {
    let content = fs::read_to_string(path)
        .map_err(|e| GwmError::config(format!("failed to read config file {:?}: {}", path, e)))?;

    toml::from_str(&content)
        .map_err(|e| GwmError::config(format!("failed to parse config file {:?}: {}", path, e)))
}

/// Load the global configuration.
pub fn load_global_config() -> (Config, Option<PathBuf>) {
    match find_global_config() {
        Some(path) => match load_config_from_file(&path) {
            Ok(config) => (config, Some(path)),
            Err(e) => {
                eprintln!(
                    "Warning: Failed to parse global config file {:?}: {}",
                    path, e
                );
                eprintln!("Using default configuration instead.");
                (Config::default(), None)
            }
        },
        None => (Config::default(), None),
    }
}

/// Load configuration with full source information.
///
/// This function:
/// 1. Loads the global config (or uses defaults)
/// 2. Loads the project config (if in a git repo)
/// 3. Merges them (project overrides global)
/// 4. Returns source information for trust verification
pub fn load_config_with_source() -> ConfigWithSource {
    let (global_config, global_path) = load_global_config();
    let repo_root = find_repo_root();

    let (project_config, project_path, has_project_hooks) = match &repo_root {
        Some(root) => match find_project_config(root) {
            Some(path) => match load_config_from_file(&path) {
                Ok(config) => {
                    let has_hooks = config
                        .hooks
                        .as_ref()
                        .and_then(|h| h.post_create.as_ref())
                        .map(|h| h.enabled && !h.commands.is_empty())
                        .unwrap_or(false);
                    (Some(config), Some(path), has_hooks)
                }
                Err(e) => {
                    eprintln!(
                        "Warning: Failed to parse project config file {:?}: {}",
                        path, e
                    );
                    eprintln!("Project-specific settings will be ignored.");
                    (None, None, false)
                }
            },
            None => (None, None, false),
        },
        None => (None, None, false),
    };

    let merged_config = match project_config {
        Some(project) => merge_configs(&global_config, &project),
        None => global_config,
    };

    ConfigWithSource {
        config: merged_config,
        global_config_path: global_path,
        project_config_path: project_path,
        has_project_hooks,
        repo_root,
    }
}

impl ConfigWithSource {
    /// Build a HookContext from this configuration.
    ///
    /// Extracts repository name and root path from the configuration,
    /// providing sensible defaults when not available.
    /// Note: Warns to stderr when falling back to defaults, as this may affect hook execution.
    pub fn build_hook_context(
        &self,
        worktree_path: &Path,
        branch_name: &str,
    ) -> crate::hooks::HookContext {
        let repo_root = self.repo_root.clone().unwrap_or_else(|| {
            eprintln!(
                "\x1b[33m⚠ Warning: Could not determine repository root, using current directory for hooks\x1b[0m"
            );
            PathBuf::from(".")
        });

        let repo_name = self
            .repo_root
            .as_ref()
            .and_then(|p| p.file_name())
            .map(|n| n.to_string_lossy().to_string())
            .unwrap_or_else(|| {
                // repo_rootがNoneの場合は上で既に警告済みなので、ここでは静かにフォールバック
                "unknown".to_string()
            });

        crate::hooks::HookContext {
            worktree_path: worktree_path.to_path_buf(),
            branch_name: branch_name.to_string(),
            repo_root,
            repo_name,
        }
    }

    /// Get the post-create hook commands from this configuration.
    ///
    /// Returns an empty vector if no commands are configured.
    pub fn get_post_create_commands(&self) -> Vec<String> {
        self.config
            .post_create_commands()
            .map(|c| c.to_vec())
            .unwrap_or_default()
    }
}

/// Load the merged configuration.
///
/// Convenience function that returns just the merged config without source info.
pub fn load_config() -> Config {
    load_config_with_source().config
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    #[test]
    fn test_find_repo_root() {
        // Create a temporary directory with a .git folder
        let temp = TempDir::new().unwrap();
        let repo_root = temp.path();
        fs::create_dir(repo_root.join(".git")).unwrap();

        // Create a subdirectory
        let subdir = repo_root.join("src").join("deep");
        fs::create_dir_all(&subdir).unwrap();

        // Should find repo root from subdirectory
        let found = find_repo_root_from(&subdir);
        assert_eq!(found, Some(repo_root.to_path_buf()));

        // Should find repo root from root itself
        let found = find_repo_root_from(repo_root);
        assert_eq!(found, Some(repo_root.to_path_buf()));
    }

    #[test]
    fn test_load_config_from_file() {
        let temp = TempDir::new().unwrap();
        let config_path = temp.path().join("config.toml");

        let content = r#"
worktree_base_path = "/custom/path"
main_branches = ["main", "develop"]
clean_branch = "auto"
"#;
        fs::write(&config_path, content).unwrap();

        let config = load_config_from_file(&config_path).unwrap();
        assert_eq!(config.worktree_base_path, "/custom/path");
        assert_eq!(config.main_branches, vec!["main", "develop"]);
        assert_eq!(
            config.clean_branch,
            super::super::types::CleanBranchMode::Auto
        );
    }

    #[test]
    fn test_load_default_config() {
        let config = Config::default();
        assert_eq!(config.worktree_base_path, "~/git-worktrees");
    }

    #[test]
    fn test_build_hook_context() {
        let temp = TempDir::new().unwrap();
        let repo_root = temp.path().join("my-repo");
        fs::create_dir(&repo_root).unwrap();

        let config_source = ConfigWithSource {
            config: Config::default(),
            global_config_path: None,
            project_config_path: None,
            has_project_hooks: false,
            repo_root: Some(repo_root.clone()),
        };

        let worktree_path = temp.path().join("worktree");
        let context = config_source.build_hook_context(&worktree_path, "feature/test");

        assert_eq!(context.worktree_path, worktree_path);
        assert_eq!(context.branch_name, "feature/test");
        assert_eq!(context.repo_root, repo_root);
        assert_eq!(context.repo_name, "my-repo");
    }

    #[test]
    fn test_build_hook_context_without_repo_root() {
        let config_source = ConfigWithSource {
            config: Config::default(),
            global_config_path: None,
            project_config_path: None,
            has_project_hooks: false,
            repo_root: None,
        };

        let worktree_path = Path::new("/tmp/worktree");
        let context = config_source.build_hook_context(worktree_path, "main");

        assert_eq!(context.worktree_path, worktree_path);
        assert_eq!(context.branch_name, "main");
        assert_eq!(context.repo_root, PathBuf::from("."));
        assert_eq!(context.repo_name, "unknown");
    }

    #[test]
    fn test_get_post_create_commands_empty() {
        let config_source = ConfigWithSource {
            config: Config::default(),
            global_config_path: None,
            project_config_path: None,
            has_project_hooks: false,
            repo_root: None,
        };

        let commands = config_source.get_post_create_commands();
        assert!(commands.is_empty());
    }
}
