//! アプリケーション状態管理
//!
//! TUIアプリケーションの状態をElmアーキテクチャライクに管理します。

use crate::config::Config;
use crate::ui::widgets::SelectState;
use crate::utils::generate_worktree_preview;

/// アプリケーション全体の状態
pub struct App {
    /// 現在の画面状態
    pub state: AppState,
    /// 設定
    pub config: Config,
    /// 終了フラグ
    pub should_quit: bool,
    /// リモートブランチフェッチ待機フラグ
    /// Loading画面描画後にフェッチを実行するために使用
    pub pending_remote_fetch: bool,
}

/// 画面状態の列挙型
pub enum AppState {
    /// ローディング中
    Loading { message: String },

    /// 成功表示
    Success {
        title: String,
        messages: Vec<String>,
    },

    /// エラー表示
    Error {
        title: String,
        messages: Vec<String>,
    },

    /// テキスト入力（新規ブランチ作成）
    TextInput {
        title: String,
        placeholder: String,
        input: TextInputState,
        validation_error: Option<String>,
        preview: Option<String>,
    },

    /// 選択リスト（リモートブランチ選択）
    SelectList {
        title: String,
        placeholder: String,
        input: TextInputState,
        state: SelectState,
        preview: Option<String>,
    },

    /// 確認ダイアログ（フック実行確認）
    Confirm {
        title: String,
        message: String,
        commands: Vec<String>,
        selected: ConfirmChoice,
        metadata: Option<ConfirmMetadata>,
    },
}

/// 確認ダイアログの選択肢
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ConfirmChoice {
    /// 信頼キャッシュに保存して実行
    Trust,
    /// 一度だけ実行
    Once,
    /// キャンセル
    Cancel,
}

/// 確認ダイアログ用メタデータ（フック実行時に使用）
#[derive(Debug, Clone)]
pub struct ConfirmMetadata {
    /// リポジトリルートパス
    pub repo_root: Option<std::path::PathBuf>,
    /// プロジェクト設定ファイルのパス
    pub config_path: std::path::PathBuf,
    /// 設定ファイルのハッシュ
    pub config_hash: String,
    /// 作成されたworktreeのパス
    pub worktree_path: String,
    /// ブランチ名
    pub branch_name: String,
}

impl ConfirmChoice {
    /// 次の選択肢に移動
    pub fn next(&self) -> Self {
        match self {
            Self::Trust => Self::Once,
            Self::Once => Self::Cancel,
            Self::Cancel => Self::Trust,
        }
    }

    /// 前の選択肢に移動
    pub fn prev(&self) -> Self {
        match self {
            Self::Trust => Self::Cancel,
            Self::Once => Self::Trust,
            Self::Cancel => Self::Once,
        }
    }

    /// 表示用ラベル
    pub fn label(&self) -> &'static str {
        match self {
            Self::Trust => "Trust",
            Self::Once => "Once",
            Self::Cancel => "Cancel",
        }
    }

    /// 説明文
    pub fn description(&self) -> &'static str {
        match self {
            Self::Trust => "Save to trust cache and run",
            Self::Once => "Run this time only",
            Self::Cancel => "Cancel operation",
        }
    }
}

/// 選択リストのアイテム
#[derive(Debug, Clone)]
pub struct SelectItem {
    /// 表示ラベル
    pub label: String,
    /// 値（選択時に使用）
    pub value: String,
    /// 説明（オプション）
    pub description: Option<String>,
    /// メタデータ（リモートブランチ情報）
    pub metadata: Option<SelectItemMetadata>,
}

/// アイテムのメタデータ（リモートブランチ情報）
#[derive(Debug, Clone)]
pub struct SelectItemMetadata {
    /// 最後のコミット日時
    pub last_commit_date: String,
    /// 最後のコミッター名
    pub last_committer_name: String,
    /// 最後のコミットメッセージ
    pub last_commit_message: String,
}

/// テキスト入力の状態
#[derive(Debug, Clone, Default)]
pub struct TextInputState {
    /// 入力テキスト
    pub value: String,
    /// カーソル位置（文字単位）
    pub cursor: usize,
}

impl TextInputState {
    /// 新しいTextInputStateを作成
    pub fn new() -> Self {
        Self::default()
    }

    /// 初期値を持つTextInputStateを作成
    pub fn with_value(value: String) -> Self {
        let cursor = value.chars().count();
        Self { value, cursor }
    }

    /// カーソル位置に文字を挿入
    pub fn insert(&mut self, c: char) {
        let byte_pos = self.cursor_byte_position();
        self.value.insert(byte_pos, c);
        self.cursor += 1;
    }

    /// カーソル前の文字を削除（Backspace）
    pub fn delete_backward(&mut self) {
        if self.cursor > 0 {
            let chars: Vec<char> = self.value.chars().collect();
            let char_start = chars[..self.cursor - 1].iter().collect::<String>().len();
            self.value.remove(char_start);
            self.cursor -= 1;
        }
    }

    /// カーソル位置の文字を削除（Delete）
    pub fn delete_forward(&mut self) {
        let byte_pos = self.cursor_byte_position();
        if byte_pos < self.value.len() {
            self.value.remove(byte_pos);
        }
    }

    /// カーソルを左に移動
    pub fn move_left(&mut self) {
        if self.cursor > 0 {
            self.cursor -= 1;
        }
    }

    /// カーソルを右に移動
    pub fn move_right(&mut self) {
        let char_count = self.value.chars().count();
        if self.cursor < char_count {
            self.cursor += 1;
        }
    }

    /// カーソルを先頭に移動
    pub fn move_start(&mut self) {
        self.cursor = 0;
    }

    /// カーソルを末尾に移動
    pub fn move_end(&mut self) {
        self.cursor = self.value.chars().count();
    }

    /// 前の単語を削除（Ctrl+W）
    pub fn delete_word_backward(&mut self) {
        if self.cursor == 0 {
            return;
        }

        let chars: Vec<char> = self.value.chars().collect();
        let mut new_cursor = self.cursor;

        // スペースをスキップ
        while new_cursor > 0 && chars[new_cursor - 1].is_whitespace() {
            new_cursor -= 1;
        }

        // 単語をスキップ
        while new_cursor > 0 && !chars[new_cursor - 1].is_whitespace() {
            new_cursor -= 1;
        }

        // 削除
        let start_byte = chars[..new_cursor].iter().collect::<String>().len();
        let end_byte = self.cursor_byte_position();
        self.value.replace_range(start_byte..end_byte, "");
        self.cursor = new_cursor;
    }

    /// 全テキストをクリア
    pub fn clear(&mut self) {
        self.value.clear();
        self.cursor = 0;
    }

    /// カーソル位置のバイトオフセットを取得
    fn cursor_byte_position(&self) -> usize {
        self.value
            .char_indices()
            .nth(self.cursor)
            .map(|(i, _)| i)
            .unwrap_or(self.value.len())
    }

    /// カーソル前のテキストを取得
    pub fn text_before_cursor(&self) -> String {
        self.value.chars().take(self.cursor).collect()
    }

    /// カーソル後のテキストを取得
    pub fn text_after_cursor(&self) -> String {
        self.value.chars().skip(self.cursor).collect()
    }
}

impl App {
    /// 新しいAppを作成
    pub fn new(config: Config) -> Self {
        Self {
            state: AppState::Loading {
                message: "Initializing...".to_string(),
            },
            config,
            should_quit: false,
            pending_remote_fetch: false,
        }
    }

    /// 終了処理
    pub fn quit(&mut self) {
        self.should_quit = true;
    }

    /// ローディング状態に遷移
    pub fn set_loading(&mut self, message: impl Into<String>) {
        self.state = AppState::Loading {
            message: message.into(),
        };
    }

    /// 成功状態に遷移
    pub fn set_success(&mut self, title: impl Into<String>, messages: Vec<String>) {
        self.state = AppState::Success {
            title: title.into(),
            messages,
        };
    }

    /// エラー状態に遷移
    pub fn set_error(&mut self, title: impl Into<String>, messages: Vec<String>) {
        self.state = AppState::Error {
            title: title.into(),
            messages,
        };
    }

    /// テキスト入力状態に遷移
    pub fn set_text_input(&mut self, title: impl Into<String>, placeholder: impl Into<String>) {
        self.state = AppState::TextInput {
            title: title.into(),
            placeholder: placeholder.into(),
            input: TextInputState::new(),
            validation_error: None,
            preview: None,
        };
    }

    /// 選択リスト状態に遷移
    pub fn set_select_list(
        &mut self,
        title: impl Into<String>,
        placeholder: impl Into<String>,
        items: Vec<SelectItem>,
    ) {
        let state = SelectState::new(items);
        let preview = state
            .selected_item()
            .and_then(|item| generate_worktree_preview(&item.value, &self.config));
        self.state = AppState::SelectList {
            title: title.into(),
            placeholder: placeholder.into(),
            input: TextInputState::new(),
            state,
            preview,
        };
    }

    /// 確認ダイアログ状態に遷移
    pub fn set_confirm(
        &mut self,
        title: impl Into<String>,
        message: impl Into<String>,
        commands: Vec<String>,
    ) {
        self.state = AppState::Confirm {
            title: title.into(),
            message: message.into(),
            commands,
            selected: ConfirmChoice::Once,
            metadata: None,
        };
    }

    /// 確認ダイアログ状態に遷移（メタデータ付き）
    pub fn set_confirm_with_metadata(
        &mut self,
        title: impl Into<String>,
        message: impl Into<String>,
        commands: Vec<String>,
        metadata: ConfirmMetadata,
    ) {
        self.state = AppState::Confirm {
            title: title.into(),
            message: message.into(),
            commands,
            selected: ConfirmChoice::Once,
            metadata: Some(metadata),
        };
    }

    /// 現在の確認ダイアログのメタデータを取得
    pub fn get_confirm_metadata(&self) -> Option<&ConfirmMetadata> {
        if let AppState::Confirm { metadata, .. } = &self.state {
            metadata.as_ref()
        } else {
            None
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_text_input_insert() {
        let mut state = TextInputState::new();
        state.insert('a');
        state.insert('b');
        state.insert('c');
        assert_eq!(state.value, "abc");
        assert_eq!(state.cursor, 3);
    }

    #[test]
    fn test_text_input_delete_backward() {
        let mut state = TextInputState::with_value("abc".to_string());
        state.delete_backward();
        assert_eq!(state.value, "ab");
        assert_eq!(state.cursor, 2);
    }

    #[test]
    fn test_text_input_delete_backward_at_start() {
        let mut state = TextInputState::with_value("abc".to_string());
        state.cursor = 0;
        state.delete_backward();
        assert_eq!(state.value, "abc");
        assert_eq!(state.cursor, 0);
    }

    #[test]
    fn test_text_input_cursor_movement() {
        let mut state = TextInputState::with_value("hello".to_string());
        assert_eq!(state.cursor, 5);

        state.move_left();
        assert_eq!(state.cursor, 4);

        state.move_start();
        assert_eq!(state.cursor, 0);

        state.move_end();
        assert_eq!(state.cursor, 5);
    }

    #[test]
    fn test_text_input_delete_word() {
        let mut state = TextInputState::with_value("hello world".to_string());
        state.delete_word_backward();
        assert_eq!(state.value, "hello ");
    }

    #[test]
    fn test_text_input_clear() {
        let mut state = TextInputState::with_value("hello".to_string());
        state.clear();
        assert_eq!(state.value, "");
        assert_eq!(state.cursor, 0);
    }

    #[test]
    fn test_text_input_unicode() {
        let mut state = TextInputState::new();
        state.insert('日');
        state.insert('本');
        state.insert('語');
        assert_eq!(state.value, "日本語");
        assert_eq!(state.cursor, 3);

        state.delete_backward();
        assert_eq!(state.value, "日本");
        assert_eq!(state.cursor, 2);
    }

    #[test]
    fn test_confirm_choice_navigation() {
        let choice = ConfirmChoice::Trust;
        assert_eq!(choice.next(), ConfirmChoice::Once);
        assert_eq!(choice.prev(), ConfirmChoice::Cancel);

        let choice = ConfirmChoice::Cancel;
        assert_eq!(choice.next(), ConfirmChoice::Trust);
    }

    #[test]
    fn test_text_before_after_cursor() {
        let mut state = TextInputState::with_value("hello world".to_string());
        state.cursor = 5;
        assert_eq!(state.text_before_cursor(), "hello");
        assert_eq!(state.text_after_cursor(), " world");
    }
}
