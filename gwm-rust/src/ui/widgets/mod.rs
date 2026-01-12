//! UIウィジェットモジュール
//!
//! 再利用可能なUIコンポーネントを提供します。
//!
//! - `table`: Worktree一覧テーブル
//! - `spinner`: ローディングスピナー
//! - `notice`: 成功/エラー通知
//! - `text_input`: テキスト入力フィールド
//! - `select_list`: 選択リスト
//! - `confirm`: 確認ダイアログ

pub mod confirm;
pub mod notice;
pub mod select_list;
pub mod spinner;
pub mod table;
pub mod text_input;

pub use confirm::ConfirmWidget;
pub use notice::{NoticeVariant, NoticeWidget};
pub use select_list::SelectListWidget;
pub use spinner::SpinnerWidget;
pub use table::{calculate_column_widths, pad_text, truncate_start, ColumnWidths, WorktreeTable};
pub use text_input::TextInputWidget;
