//! Configuration type definitions.
//!
//! These types are designed to be fully compatible with the TypeScript version's
//! config.toml format.

use serde::Deserialize;

/// Branch cleanup mode after worktree removal.
#[derive(Debug, Clone, Default, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum CleanBranchMode {
    /// Automatically delete the local branch
    Auto,
    /// Ask user before deleting
    #[default]
    Ask,
    /// Never delete the local branch
    Never,
}

/// Configuration for copying gitignored files to new worktrees.
#[derive(Debug, Clone, Deserialize)]
pub struct CopyIgnoredFilesConfig {
    /// Whether to enable copying of gitignored files
    #[serde(default = "default_copy_enabled")]
    pub enabled: bool,

    /// Glob patterns to match files to copy (e.g., ".env", ".env.*")
    #[serde(default = "default_copy_patterns")]
    pub patterns: Vec<String>,

    /// Glob patterns to exclude from copying (e.g., ".env.example")
    #[serde(default)]
    pub exclude_patterns: Vec<String>,
}

impl Default for CopyIgnoredFilesConfig {
    fn default() -> Self {
        Self {
            enabled: default_copy_enabled(),
            patterns: default_copy_patterns(),
            exclude_patterns: default_exclude_patterns(),
        }
    }
}

fn default_exclude_patterns() -> Vec<String> {
    vec![".env.example".to_string(), ".env.sample".to_string()]
}

fn default_copy_enabled() -> bool {
    true
}

fn default_copy_patterns() -> Vec<String> {
    vec![
        ".env".to_string(),
        ".env.*".to_string(),
        ".env.local".to_string(),
        ".env.*.local".to_string(),
    ]
}

/// Custom virtual environment pattern for a specific language.
#[derive(Debug, Clone, Deserialize)]
pub struct CustomVirtualEnvPattern {
    /// Language identifier (e.g., "python", "node")
    pub language: String,

    /// Directory patterns to detect (e.g., ["venv", ".venv"])
    pub patterns: Vec<String>,

    /// Optional setup commands
    #[serde(default)]
    pub commands: Vec<String>,
}

/// Configuration for virtual environment handling.
#[derive(Debug, Clone, Deserialize)]
pub struct VirtualEnvConfig {
    /// Whether to isolate virtual environments (don't copy, rewrite symlinks)
    #[serde(default)]
    pub isolate_virtual_envs: Option<bool>,

    /// Deprecated: use isolate_virtual_envs instead
    #[serde(default)]
    pub mode: Option<String>,

    /// Custom patterns for detecting virtual environments
    #[serde(default)]
    pub custom_patterns: Vec<CustomVirtualEnvPattern>,

    /// Maximum file size in MB to copy (-1 for unlimited)
    #[serde(default)]
    pub max_file_size_mb: Option<i64>,

    /// Maximum directory size in MB to copy (-1 for unlimited)
    #[serde(default)]
    pub max_dir_size_mb: Option<i64>,

    /// Maximum scan depth for directory traversal (-1 for unlimited)
    #[serde(default)]
    pub max_scan_depth: Option<i32>,

    /// Parallelism level for copy operations (0 for CPU count)
    #[serde(default)]
    pub copy_parallelism: Option<u32>,

    /// Deprecated: use max_file_size_mb instead
    #[serde(default)]
    pub max_copy_size_mb: Option<i64>,
}

impl Default for VirtualEnvConfig {
    fn default() -> Self {
        // Note: All fields are None to distinguish "not set" from "set to default value"
        // during config merging. Use the accessor methods (e.g., should_isolate()) to get
        // the effective value with proper defaults applied.
        Self {
            isolate_virtual_envs: None,
            mode: None,
            custom_patterns: Vec::new(),
            max_file_size_mb: None,
            max_dir_size_mb: None,
            max_scan_depth: None,
            copy_parallelism: None,
            max_copy_size_mb: None,
        }
    }
}

/// Default values for VirtualEnvConfig (matching TypeScript version)
mod virtual_env_defaults {
    pub const ISOLATE_VIRTUAL_ENVS: bool = false;
    pub const MAX_FILE_SIZE_MB: i64 = 100;
    pub const MAX_DIR_SIZE_MB: i64 = 500;
    pub const MAX_SCAN_DEPTH: i32 = 5;
    pub const COPY_PARALLELISM: u32 = 4;
}

impl VirtualEnvConfig {
    /// Get the effective isolate_virtual_envs value, handling backward compatibility.
    pub fn should_isolate(&self) -> bool {
        // Priority: isolate_virtual_envs > mode > default
        if let Some(isolate) = self.isolate_virtual_envs {
            return isolate;
        }
        if let Some(ref mode) = self.mode {
            return mode == "skip";
        }
        virtual_env_defaults::ISOLATE_VIRTUAL_ENVS
    }

    /// Get the effective max file size in MB.
    pub fn effective_max_file_size_mb(&self) -> i64 {
        // Priority: max_file_size_mb > max_copy_size_mb > default
        self.max_file_size_mb
            .or(self.max_copy_size_mb)
            .unwrap_or(virtual_env_defaults::MAX_FILE_SIZE_MB)
    }

    /// Get the effective max directory size in MB.
    pub fn effective_max_dir_size_mb(&self) -> i64 {
        self.max_dir_size_mb
            .unwrap_or(virtual_env_defaults::MAX_DIR_SIZE_MB)
    }

    /// Get the effective max scan depth.
    pub fn effective_max_scan_depth(&self) -> i32 {
        self.max_scan_depth
            .unwrap_or(virtual_env_defaults::MAX_SCAN_DEPTH)
    }

    /// Get the effective copy parallelism.
    pub fn effective_copy_parallelism(&self) -> u32 {
        self.copy_parallelism
            .unwrap_or(virtual_env_defaults::COPY_PARALLELISM)
    }
}

/// Configuration for a single hook.
#[derive(Debug, Clone, Deserialize)]
pub struct HookConfig {
    /// Whether the hook is enabled
    #[serde(default = "default_hook_enabled")]
    pub enabled: bool,

    /// Commands to execute
    #[serde(default)]
    pub commands: Vec<String>,
}

impl Default for HookConfig {
    fn default() -> Self {
        Self {
            enabled: true,
            commands: Vec::new(),
        }
    }
}

fn default_hook_enabled() -> bool {
    true
}

/// Configuration for all hooks.
#[derive(Debug, Clone, Deserialize)]
pub struct HooksConfig {
    /// Hook executed after creating a worktree
    #[serde(default)]
    pub post_create: Option<HookConfig>,
}

/// Main application configuration.
#[derive(Debug, Clone, Deserialize)]
pub struct Config {
    /// Base path for worktrees (default: ~/worktrees)
    #[serde(default = "default_worktree_base_path")]
    pub worktree_base_path: String,

    /// List of main branch names (default: ["main", "master", "develop"])
    #[serde(default = "default_main_branches")]
    pub main_branches: Vec<String>,

    /// Branch cleanup mode after worktree removal
    #[serde(default)]
    pub clean_branch: CleanBranchMode,

    /// Configuration for copying gitignored files
    #[serde(default)]
    pub copy_ignored_files: Option<CopyIgnoredFilesConfig>,

    /// Configuration for virtual environment handling
    #[serde(default)]
    pub virtual_env_handling: Option<VirtualEnvConfig>,

    /// Hook configurations
    #[serde(default)]
    pub hooks: Option<HooksConfig>,
}

fn default_worktree_base_path() -> String {
    "~/git-worktrees".to_string()
}

fn default_main_branches() -> Vec<String> {
    vec![
        "main".to_string(),
        "master".to_string(),
        "develop".to_string(),
    ]
}

impl Default for Config {
    fn default() -> Self {
        Self {
            worktree_base_path: default_worktree_base_path(),
            main_branches: default_main_branches(),
            clean_branch: CleanBranchMode::default(),
            copy_ignored_files: Some(CopyIgnoredFilesConfig::default()),
            virtual_env_handling: Some(VirtualEnvConfig::default()),
            hooks: Some(HooksConfig::default()),
        }
    }
}

impl Default for HooksConfig {
    fn default() -> Self {
        Self {
            post_create: Some(HookConfig::default()),
        }
    }
}

impl Config {
    /// Expand ~ in worktree_base_path to the actual home directory.
    pub fn expanded_worktree_base_path(&self) -> Option<std::path::PathBuf> {
        let path = &self.worktree_base_path;
        if path.starts_with("~/") {
            dirs::home_dir().map(|home| home.join(&path[2..]))
        } else if path == "~" {
            dirs::home_dir()
        } else {
            Some(std::path::PathBuf::from(path))
        }
    }

    /// Check if a branch name is considered a main branch.
    pub fn is_main_branch(&self, branch: &str) -> bool {
        self.main_branches.iter().any(|b| b == branch)
    }

    /// Get post_create hook commands if enabled.
    pub fn post_create_commands(&self) -> Option<&[String]> {
        self.hooks
            .as_ref()
            .and_then(|h| h.post_create.as_ref())
            .filter(|h| h.enabled && !h.commands.is_empty())
            .map(|h| h.commands.as_slice())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_default_config() {
        let config = Config::default();
        assert_eq!(config.worktree_base_path, "~/git-worktrees");
        assert_eq!(
            config.main_branches,
            vec!["main", "master", "develop"]
        );
        assert_eq!(config.clean_branch, CleanBranchMode::Ask);

        // Verify hooks default
        assert!(config.hooks.is_some());
        let hooks = config.hooks.as_ref().unwrap();
        assert!(hooks.post_create.is_some());
        let post_create = hooks.post_create.as_ref().unwrap();
        assert!(post_create.enabled);
        assert!(post_create.commands.is_empty());

        // Verify copy_ignored_files defaults
        let copy_config = config.copy_ignored_files.as_ref().unwrap();
        assert!(copy_config.enabled);
        assert_eq!(
            copy_config.exclude_patterns,
            vec![".env.example", ".env.sample"]
        );
    }

    #[test]
    fn test_is_main_branch() {
        let config = Config::default();
        assert!(config.is_main_branch("main"));
        assert!(config.is_main_branch("master"));
        assert!(config.is_main_branch("develop"));
        assert!(!config.is_main_branch("feature/test"));
    }

    #[test]
    fn test_expanded_path() {
        let config = Config::default();
        let path = config.expanded_worktree_base_path();
        assert!(path.is_some());
        let path = path.unwrap();
        assert!(!path.to_string_lossy().contains('~'));
    }

    #[test]
    fn test_virtual_env_backward_compat() {
        let config = VirtualEnvConfig {
            mode: Some("skip".to_string()),
            isolate_virtual_envs: None,
            ..Default::default()
        };
        assert!(config.should_isolate());

        let config = VirtualEnvConfig {
            mode: Some("ignore".to_string()),
            isolate_virtual_envs: None,
            ..Default::default()
        };
        assert!(!config.should_isolate());

        // isolate_virtual_envs takes precedence
        let config = VirtualEnvConfig {
            mode: Some("skip".to_string()),
            isolate_virtual_envs: Some(false),
            ..Default::default()
        };
        assert!(!config.should_isolate());
    }

    #[test]
    fn test_clean_branch_mode_deserialize() {
        let toml = r#"clean_branch = "auto""#;
        #[derive(Deserialize)]
        struct Test {
            clean_branch: CleanBranchMode,
        }
        let t: Test = toml::from_str(toml).unwrap();
        assert_eq!(t.clean_branch, CleanBranchMode::Auto);
    }
}
