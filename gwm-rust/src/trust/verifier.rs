//! Trust verification logic.
//!
//! Verifies whether hook execution should be allowed based on the trust cache.

use std::path::Path;

use super::cache::get_trusted_info;
use super::hash::compute_file_hash;
use super::types::{ConfirmationReason, TrustStatus};
use crate::config::Config;

/// Verify the trust status of a project's hooks.
///
/// # Arguments
///
/// * `repo_root` - Root path of the Git repository
/// * `config` - Merged configuration (global + project)
/// * `has_project_hooks` - Whether the project config defines hooks
/// * `project_config_path` - Path to the project configuration file
///
/// # Returns
///
/// A `TrustStatus` indicating whether hooks can be executed.
pub fn verify_trust(
    repo_root: &Path,
    config: &Config,
    has_project_hooks: bool,
    project_config_path: Option<&Path>,
) -> TrustStatus {
    // Check if hooks are configured
    let commands = match config.post_create_commands() {
        Some(cmds) if !cmds.is_empty() => cmds.to_vec(),
        _ => return TrustStatus::NoHooks,
    };

    // If no project hooks, only global config is used (always trusted)
    if !has_project_hooks {
        return TrustStatus::GlobalConfig;
    }

    // Get project config path
    let config_path = match project_config_path {
        Some(path) if path.exists() => path,
        _ => return TrustStatus::GlobalConfig,
    };

    // Compute current hash
    let current_hash = match compute_file_hash(config_path) {
        Ok(hash) => hash,
        Err(_) => {
            return TrustStatus::NeedsConfirmation {
                reason: ConfirmationReason::FirstTime,
                commands,
                config_path: config_path.to_path_buf(),
                config_hash: String::new(),
            }
        }
    };

    // Check trust cache
    let repo_root_str = repo_root.display().to_string();
    let trusted_info = get_trusted_info(&repo_root_str);

    match trusted_info {
        None => TrustStatus::NeedsConfirmation {
            reason: ConfirmationReason::FirstTime,
            commands,
            config_path: config_path.to_path_buf(),
            config_hash: current_hash,
        },
        Some(info) if info.config_hash != current_hash => TrustStatus::NeedsConfirmation {
            reason: ConfirmationReason::ConfigChanged,
            commands,
            config_path: config_path.to_path_buf(),
            config_hash: current_hash,
        },
        Some(_) => TrustStatus::Trusted,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_verify_trust_no_hooks() {
        let config = Config::default();
        let status = verify_trust(Path::new("/repo"), &config, false, None);

        assert!(matches!(status, TrustStatus::NoHooks));
    }

    #[test]
    fn test_verify_trust_global_only() {
        // Config with hooks but no project hooks
        let mut config = Config::default();
        config.hooks = Some(crate::config::HooksConfig {
            post_create: Some(crate::config::HookConfig {
                enabled: true,
                commands: vec!["npm install".to_string()],
            }),
        });

        let status = verify_trust(Path::new("/repo"), &config, false, None);

        assert!(matches!(status, TrustStatus::GlobalConfig));
    }
}
