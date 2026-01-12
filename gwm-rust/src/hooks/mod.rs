//! Hook execution module.
//!
//! Provides functionality for running post-create hooks after worktree creation.
//!
//! # Overview
//!
//! Hooks are shell commands defined in the configuration file that run automatically
//! after a worktree is created. Common use cases include:
//!
//! - Installing dependencies (`npm install`, `pip install -r requirements.txt`)
//! - Running build commands (`npm run build`, `cargo build`)
//! - Setting up development environment
//!
//! # Environment Variables
//!
//! The following environment variables are available to hook commands:
//!
//! | Variable | Description |
//! |----------|-------------|
//! | `GWM_WORKTREE_PATH` | Absolute path to the new worktree |
//! | `GWM_BRANCH_NAME` | Name of the branch |
//! | `GWM_REPO_ROOT` | Root path of the Git repository |
//! | `GWM_REPO_NAME` | Name of the repository |
//!
//! # Example Configuration
//!
//! ```toml
//! [hooks.post_create]
//! enabled = true
//! commands = [
//!     "npm install",
//!     "npm run build",
//! ]
//! ```
//!
//! # Example Usage
//!
//! ```ignore
//! use gwm::hooks::{run_post_create_hooks, HookContext};
//!
//! let context = HookContext {
//!     worktree_path: PathBuf::from("/path/to/worktree"),
//!     branch_name: "feature/my-feature".to_string(),
//!     repo_root: PathBuf::from("/path/to/repo"),
//!     repo_name: "my-repo".to_string(),
//! };
//!
//! let result = run_post_create_hooks(&config, &context)?;
//! if result.success {
//!     println!("All hooks completed successfully!");
//! }
//! ```

pub mod runner;
pub mod types;

pub use runner::run_post_create_hooks;
pub use types::{HookContext, HookResult};
