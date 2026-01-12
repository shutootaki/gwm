//! Git操作モジュール
//!
//! Gitリポジトリおよびworktreeに関する操作を提供します。

pub mod add;
pub mod core;
pub mod remote;
pub mod types;
pub mod worktree;

pub use add::{add_worktree, AddWorktreeOptions, AddWorktreeResult};
pub use core::{
    get_repo_root, get_repository_name, is_git_repository, is_git_repository_at,
    local_branch_exists, parse_repo_name_from_url,
};
pub use remote::{
    check_remote_branch_status, fetch_and_prune, get_remote_branches_with_info, RemoteBranchInfo,
    RemoteBranchStatus,
};
pub use types::{PullResult, Worktree, WorktreeStatus};
pub use worktree::{get_main_worktree_path, get_worktrees, parse_worktrees};
