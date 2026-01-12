//! Configuration merging logic.
//!
//! Project configuration overrides global configuration.
//! For nested objects, deep merging is performed.
//! For arrays, project values completely replace global values.

use super::types::{
    CleanBranchMode, Config, CopyIgnoredFilesConfig, HookConfig, HooksConfig, VirtualEnvConfig,
};

/// Default values used for comparison during merging.
/// These must match the defaults in types.rs.
mod defaults {
    pub const WORKTREE_BASE_PATH: &str = "~/git-worktrees";
    pub const MAIN_BRANCHES: &[&str] = &["main", "master", "develop"];
}

/// Merge two configurations (project overrides global).
pub fn merge_configs(global: &Config, project: &Config) -> Config {
    Config {
        // Simple values: project overrides if different from default
        worktree_base_path: if project.worktree_base_path != defaults::WORKTREE_BASE_PATH {
            project.worktree_base_path.clone()
        } else {
            global.worktree_base_path.clone()
        },

        // Arrays: project completely replaces global
        main_branches: if !project.main_branches.is_empty()
            && project.main_branches != defaults::MAIN_BRANCHES
        {
            project.main_branches.clone()
        } else {
            global.main_branches.clone()
        },

        // Enum: project overrides if not default
        clean_branch: if project.clean_branch != CleanBranchMode::Ask {
            project.clean_branch.clone()
        } else {
            global.clean_branch.clone()
        },

        // Nested objects: deep merge
        copy_ignored_files: merge_copy_ignored_files(
            global.copy_ignored_files.as_ref(),
            project.copy_ignored_files.as_ref(),
        ),

        virtual_env_handling: merge_virtual_env(
            global.virtual_env_handling.as_ref(),
            project.virtual_env_handling.as_ref(),
        ),

        hooks: merge_hooks(global.hooks.as_ref(), project.hooks.as_ref()),
    }
}

fn merge_copy_ignored_files(
    global: Option<&CopyIgnoredFilesConfig>,
    project: Option<&CopyIgnoredFilesConfig>,
) -> Option<CopyIgnoredFilesConfig> {
    match (global, project) {
        (None, None) => None,
        (Some(g), None) => Some(g.clone()),
        (None, Some(p)) => Some(p.clone()),
        (Some(g), Some(p)) => Some(CopyIgnoredFilesConfig {
            enabled: p.enabled,
            // Arrays: project replaces global
            patterns: if !p.patterns.is_empty() {
                p.patterns.clone()
            } else {
                g.patterns.clone()
            },
            exclude_patterns: if !p.exclude_patterns.is_empty() {
                p.exclude_patterns.clone()
            } else {
                g.exclude_patterns.clone()
            },
        }),
    }
}

fn merge_virtual_env(
    global: Option<&VirtualEnvConfig>,
    project: Option<&VirtualEnvConfig>,
) -> Option<VirtualEnvConfig> {
    match (global, project) {
        (None, None) => None,
        (Some(g), None) => Some(g.clone()),
        (None, Some(p)) => Some(p.clone()),
        (Some(g), Some(p)) => Some(VirtualEnvConfig {
            isolate_virtual_envs: p.isolate_virtual_envs.or(g.isolate_virtual_envs),
            mode: p.mode.clone().or_else(|| g.mode.clone()),
            custom_patterns: if !p.custom_patterns.is_empty() {
                p.custom_patterns.clone()
            } else {
                g.custom_patterns.clone()
            },
            max_file_size_mb: p.max_file_size_mb.or(g.max_file_size_mb),
            max_dir_size_mb: p.max_dir_size_mb.or(g.max_dir_size_mb),
            max_scan_depth: p.max_scan_depth.or(g.max_scan_depth),
            copy_parallelism: p.copy_parallelism.or(g.copy_parallelism),
            max_copy_size_mb: p.max_copy_size_mb.or(g.max_copy_size_mb),
        }),
    }
}

fn merge_hooks(global: Option<&HooksConfig>, project: Option<&HooksConfig>) -> Option<HooksConfig> {
    match (global, project) {
        (None, None) => None,
        (Some(g), None) => Some(g.clone()),
        (None, Some(p)) => Some(p.clone()),
        (Some(g), Some(p)) => Some(HooksConfig {
            post_create: merge_hook_config(
                g.post_create.as_ref(),
                p.post_create.as_ref(),
            ),
        }),
    }
}

fn merge_hook_config(
    global: Option<&HookConfig>,
    project: Option<&HookConfig>,
) -> Option<HookConfig> {
    match (global, project) {
        (None, None) => None,
        (Some(g), None) => Some(g.clone()),
        (None, Some(p)) => Some(p.clone()),
        (Some(g), Some(p)) => Some(HookConfig {
            enabled: p.enabled,
            // Commands: project replaces global
            commands: if !p.commands.is_empty() {
                p.commands.clone()
            } else {
                g.commands.clone()
            },
        }),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_merge_simple_values() {
        let global = Config {
            worktree_base_path: "/global/path".to_string(),
            main_branches: vec!["main".to_string()],
            clean_branch: CleanBranchMode::Auto,
            ..Default::default()
        };

        let project = Config {
            worktree_base_path: "/project/path".to_string(),
            main_branches: vec!["develop".to_string()],
            clean_branch: CleanBranchMode::Never,
            ..Default::default()
        };

        let merged = merge_configs(&global, &project);
        assert_eq!(merged.worktree_base_path, "/project/path");
        assert_eq!(merged.main_branches, vec!["develop"]);
        assert_eq!(merged.clean_branch, CleanBranchMode::Never);
    }

    #[test]
    fn test_merge_uses_global_when_project_is_default() {
        let global = Config {
            worktree_base_path: "/global/path".to_string(),
            main_branches: vec!["main".to_string(), "release".to_string()],
            clean_branch: CleanBranchMode::Auto,
            ..Default::default()
        };

        let project = Config::default();

        let merged = merge_configs(&global, &project);
        assert_eq!(merged.worktree_base_path, "/global/path");
        assert_eq!(merged.main_branches, vec!["main", "release"]);
        assert_eq!(merged.clean_branch, CleanBranchMode::Auto);
    }

    #[test]
    fn test_merge_hooks() {
        let global = Config {
            hooks: Some(HooksConfig {
                post_create: Some(HookConfig {
                    enabled: true,
                    commands: vec!["npm install".to_string()],
                }),
            }),
            ..Default::default()
        };

        let project = Config {
            hooks: Some(HooksConfig {
                post_create: Some(HookConfig {
                    enabled: true,
                    commands: vec!["pnpm install".to_string()],
                }),
            }),
            ..Default::default()
        };

        let merged = merge_configs(&global, &project);
        let commands = merged.post_create_commands().unwrap();
        assert_eq!(commands, &["pnpm install"]);
    }

    #[test]
    fn test_merge_virtual_env() {
        let global = Config {
            virtual_env_handling: Some(VirtualEnvConfig {
                isolate_virtual_envs: Some(true),
                max_file_size_mb: Some(50),
                ..Default::default()
            }),
            ..Default::default()
        };

        // Project config that only specifies some fields
        // Note: We explicitly set isolate_virtual_envs to None to test
        // that global value is used when project doesn't specify
        let project = Config {
            virtual_env_handling: Some(VirtualEnvConfig {
                isolate_virtual_envs: None, // Not specified in project
                mode: None,
                custom_patterns: Vec::new(),
                max_file_size_mb: Some(100),
                max_dir_size_mb: Some(200),
                max_scan_depth: None,
                copy_parallelism: None,
                max_copy_size_mb: None,
            }),
            ..Default::default()
        };

        let merged = merge_configs(&global, &project);
        let ve = merged.virtual_env_handling.unwrap();
        // Project overrides
        assert_eq!(ve.max_file_size_mb, Some(100));
        assert_eq!(ve.max_dir_size_mb, Some(200));
        // Global value used when project doesn't specify
        assert_eq!(ve.isolate_virtual_envs, Some(true));
    }
}
