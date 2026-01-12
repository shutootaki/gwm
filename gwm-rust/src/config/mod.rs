//! Configuration management for gwm.
//!
//! This module handles loading and merging configuration from:
//! - Global config: ~/.config/gwm/config.toml or ~/.gwmrc
//! - Project config: <repo-root>/gwm/config.toml
//!
//! # Example
//!
//! ```no_run
//! use gwm::config::{load_config, load_config_with_source};
//!
//! // Simple usage - just get the merged config
//! let config = load_config();
//!
//! // Advanced usage - get config with source info for trust verification
//! let config_with_source = load_config_with_source();
//! if config_with_source.has_project_hooks {
//!     // Need to verify trust before running hooks
//! }
//! ```

mod loader;
mod merger;
pub mod types;

pub use loader::{
    find_repo_root, find_repo_root_from, load_config, load_config_with_source, ConfigWithSource,
};
pub use types::{
    CleanBranchMode, Config, CopyIgnoredFilesConfig, HookConfig, HooksConfig, VirtualEnvConfig,
};
