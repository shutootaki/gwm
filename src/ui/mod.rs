//! UIモジュール
//!
//! ターミナルUIコンポーネントとビューを提供します。
//!
//! - `app`: アプリケーション状態管理
//! - `colors`: ANSI color constants
//! - `error`: 構造化エラー表示
//! - `event`: イベントハンドリング
//! - `fuzzy`: ファジーマッチング
//! - `summary`: 操作サマリー表示
//! - `views`: 各コマンドのビュー
//! - `widgets`: 再利用可能なUIウィジェット

pub mod app;
pub mod colors;
pub mod error;
pub mod event;
pub mod fuzzy;
pub mod summary;
pub mod views;
pub mod widgets;

pub use app::{App, AppState, ConfirmChoice, SelectItem, SelectItemMetadata, TextInputState};
pub use event::{
    get_confirm_choice, get_input_value, get_selected_item, get_validation_error, handle_key_event,
    poll_event, update_text_input_validation,
};
