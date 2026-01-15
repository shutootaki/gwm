//! ユーティリティモジュール
//!
//! 共通のユーティリティ関数を提供します。
//! - バリデーション: ブランチ名の検証とサニタイズ
//! - フォーマット: 日時の相対時間表示
//! - エディタ: VS Code/Cursorでディレクトリを開く
//! - コピー: gitignoreされたファイルのコピー
//! - 仮想環境: Python venv、node_modulesの検出と隔離

pub mod copy;
pub mod editor;
pub mod formatting;
pub mod validation;
pub mod virtualenv;

pub use copy::{copy_ignored_files, CopyResult};
pub use editor::{open_in_cursor, open_in_editor, open_in_vscode, open_in_zed, EditorType};
pub use formatting::format_relative_time;
pub use validation::{generate_worktree_preview, sanitize_branch_name, validate_branch_name};
pub use virtualenv::{
    detect_virtual_envs, print_virtualenv_suggestions, should_skip_virtualenv,
    suggest_virtualenv_setup, VirtualEnvDetection, VirtualEnvType,
};
