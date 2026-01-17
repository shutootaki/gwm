//! Trust management module.
//!
//! Handles verification and caching of trusted repositories for safe hook execution.
//!
//! # Overview
//!
//! When a project defines post-create hooks, gwm requires user confirmation before
//! executing them. Once confirmed, the project is added to a trust cache so that
//! subsequent hook executions don't require re-confirmation.
//!
//! The trust cache stores:
//! - The path to the project configuration file
//! - A SHA-256 hash of the configuration file
//! - The timestamp when trust was granted
//! - The list of trusted commands
//!
//! If the configuration file changes, the user will be prompted to re-confirm.
//!
//! # Cache Location
//!
//! The trust cache is stored at `~/.config/gwm/trusted_repos.json`.
//!
//! # Example
//!
//! ```ignore
//! use gwm::trust::{verify_trust, TrustStatus};
//!
//! let status = verify_trust(repo_root, config, has_project_hooks, project_config_path);
//!
//! match status {
//!     TrustStatus::Trusted => { /* Execute hooks */ }
//!     TrustStatus::NeedsConfirmation { commands, .. } => { /* Show confirmation UI */ }
//!     TrustStatus::NoHooks => { /* Nothing to do */ }
//!     TrustStatus::GlobalConfig => { /* Execute hooks (global only) */ }
//! }
//! ```

pub mod cache;
pub mod hash;
pub mod types;
pub mod verifier;

pub use cache::{get_trusted_info, revoke_trust, trust_repository};
pub use hash::compute_file_hash;
pub use types::{ConfirmationReason, TrustCache, TrustStatus, TrustedRepo};
pub use verifier::verify_trust;
