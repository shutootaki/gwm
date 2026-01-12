//! ユーティリティモジュール
//!
//! 共通のユーティリティ関数を提供します。
//! - バリデーション: ブランチ名の検証とサニタイズ
//! - フォーマット: 日時の相対時間表示

pub mod formatting;
pub mod validation;

pub use formatting::format_relative_time;
pub use validation::{generate_worktree_preview, sanitize_branch_name, validate_branch_name};
