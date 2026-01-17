//! Git操作モジュール
//!
//! Gitリポジトリおよびworktreeに関する操作を提供します。

pub mod add;
pub mod clean;
pub mod core;
pub mod pull;
pub mod remote;
pub mod remove;
pub mod types;
pub mod worktree;

pub use add::{add_worktree, AddWorktreeOptions, AddWorktreeResult};
pub use clean::{check_local_changes, get_cleanable_worktrees};
pub use core::{
    get_repo_root, get_repo_root_at, get_repository_name, is_git_repository, is_git_repository_at,
    local_branch_exists, parse_repo_name_from_url,
};
pub use pull::{is_already_up_to_date, pull_in_directory};
pub use remote::{
    check_remote_branch_status, fetch_and_prune, get_remote_branches_with_info, RemoteBranchInfo,
    RemoteBranchStatus,
};
pub use remove::{delete_local_branch, is_branch_merged, remove_worktree, RemoveResult};
pub use types::{
    ChangeStatus, CleanReason, CleanableWorktree, LocalChanges, PullResult, SyncStatus, Worktree,
    WorktreeStatus, CHANGES_LEGEND, STATUS_LEGEND,
};
pub use worktree::{
    get_main_worktree_path, get_worktrees, get_worktrees_with_details, parse_worktrees,
};
