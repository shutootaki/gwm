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
    // SECURITY: If project hooks exist but config path is missing or invalid,
    // require confirmation to prevent trust-bypass attacks
    let config_path = match project_config_path {
        Some(path) if path.exists() => path,
        Some(path) => {
            // Config path provided but file doesn't exist - require confirmation
            return TrustStatus::NeedsConfirmation {
                reason: ConfirmationReason::FirstTime,
                commands,
                config_path: path.to_path_buf(),
                config_hash: String::new(),
            };
        }
        None => {
            // No config path but project hooks exist - require confirmation
            // Use repo root as fallback path for display purposes
            return TrustStatus::NeedsConfirmation {
                reason: ConfirmationReason::FirstTime,
                commands,
                config_path: repo_root.to_path_buf(),
                config_hash: String::new(),
            };
        }
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

    // Check trust cache (path is normalized internally)
    let trusted_info = get_trusted_info(repo_root);

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
    use tempfile::TempDir;

    fn create_config_with_hooks() -> Config {
        let mut config = Config::default();
        config.hooks = Some(crate::config::HooksConfig {
            post_create: Some(crate::config::HookConfig {
                enabled: true,
                commands: vec!["npm install".to_string()],
            }),
        });
        config
    }

    #[test]
    fn test_verify_trust_no_hooks() {
        let config = Config::default();
        let status = verify_trust(Path::new("/repo"), &config, false, None);

        assert!(matches!(status, TrustStatus::NoHooks));
    }

    #[test]
    fn test_verify_trust_global_only() {
        // Config with hooks but no project hooks
        let config = create_config_with_hooks();
        let status = verify_trust(Path::new("/repo"), &config, false, None);

        assert!(matches!(status, TrustStatus::GlobalConfig));
    }

    #[test]
    fn test_verify_trust_project_hooks_no_config_path() {
        // has_project_hooks=true but config_path=None → NeedsConfirmation
        let config = create_config_with_hooks();
        let status = verify_trust(Path::new("/repo"), &config, true, None);

        match status {
            TrustStatus::NeedsConfirmation {
                reason,
                commands,
                config_path,
                config_hash,
            } => {
                assert_eq!(reason, ConfirmationReason::FirstTime);
                assert_eq!(commands, vec!["npm install".to_string()]);
                assert_eq!(config_path, Path::new("/repo"));
                assert!(config_hash.is_empty());
            }
            _ => panic!("Expected NeedsConfirmation, got {:?}", status),
        }
    }

    #[test]
    fn test_verify_trust_config_path_not_exist() {
        // config_path が存在しないファイルを指している → NeedsConfirmation
        let config = create_config_with_hooks();
        let nonexistent_path = Path::new("/nonexistent/config.toml");
        let status = verify_trust(Path::new("/repo"), &config, true, Some(nonexistent_path));

        match status {
            TrustStatus::NeedsConfirmation {
                reason,
                commands,
                config_path,
                config_hash,
            } => {
                assert_eq!(reason, ConfirmationReason::FirstTime);
                assert_eq!(commands, vec!["npm install".to_string()]);
                assert_eq!(config_path, nonexistent_path);
                assert!(config_hash.is_empty());
            }
            _ => panic!("Expected NeedsConfirmation, got {:?}", status),
        }
    }

    #[test]
    fn test_verify_trust_first_time_with_valid_config() {
        // 有効なconfigファイルがあるが、キャッシュがない → NeedsConfirmation(FirstTime)
        let temp_dir = TempDir::new().unwrap();
        let config_path = temp_dir.path().join("config.toml");
        std::fs::write(&config_path, "[hooks]\npost_create = []").unwrap();

        let config = create_config_with_hooks();
        let status = verify_trust(temp_dir.path(), &config, true, Some(&config_path));

        match status {
            TrustStatus::NeedsConfirmation {
                reason,
                commands,
                config_path: returned_path,
                config_hash,
            } => {
                assert_eq!(reason, ConfirmationReason::FirstTime);
                assert_eq!(commands, vec!["npm install".to_string()]);
                assert_eq!(returned_path, config_path);
                assert!(!config_hash.is_empty()); // Hash should be computed
            }
            _ => panic!("Expected NeedsConfirmation(FirstTime), got {:?}", status),
        }
    }

    #[test]
    fn test_verify_trust_commands_included() {
        // NeedsConfirmation に正しいコマンドリストが含まれることを確認
        let mut config = Config::default();
        config.hooks = Some(crate::config::HooksConfig {
            post_create: Some(crate::config::HookConfig {
                enabled: true,
                commands: vec![
                    "npm install".to_string(),
                    "npm run build".to_string(),
                    "npm test".to_string(),
                ],
            }),
        });

        let status = verify_trust(Path::new("/repo"), &config, true, None);

        match status {
            TrustStatus::NeedsConfirmation { commands, .. } => {
                assert_eq!(commands.len(), 3);
                assert_eq!(commands[0], "npm install");
                assert_eq!(commands[1], "npm run build");
                assert_eq!(commands[2], "npm test");
            }
            _ => panic!("Expected NeedsConfirmation, got {:?}", status),
        }
    }

    #[test]
    fn test_verify_trust_hooks_disabled() {
        // hooks.post_create.enabled = false の場合 → NoHooks
        let mut config = Config::default();
        config.hooks = Some(crate::config::HooksConfig {
            post_create: Some(crate::config::HookConfig {
                enabled: false,
                commands: vec!["npm install".to_string()],
            }),
        });

        let status = verify_trust(Path::new("/repo"), &config, true, None);

        assert!(matches!(status, TrustStatus::NoHooks));
    }

    #[test]
    fn test_verify_trust_empty_commands() {
        // hooks.post_create.commands が空の場合 → NoHooks
        let mut config = Config::default();
        config.hooks = Some(crate::config::HooksConfig {
            post_create: Some(crate::config::HookConfig {
                enabled: true,
                commands: vec![],
            }),
        });

        let status = verify_trust(Path::new("/repo"), &config, true, None);

        assert!(matches!(status, TrustStatus::NoHooks));
    }
}
