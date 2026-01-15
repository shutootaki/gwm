//! エディタ起動ユーティリティ
//!
//! VS CodeやCursorなどのエディタでディレクトリを開く機能を提供します。

use std::path::Path;
use std::process::Command;

use crate::error::{GwmError, Result};

/// エディタタイプ
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum EditorType {
    /// VS Code
    VsCode,
    /// Cursor
    Cursor,
    /// Zed
    Zed,
}

impl EditorType {
    /// エディタのコマンド名を取得
    pub fn command(&self) -> &'static str {
        match self {
            EditorType::VsCode => "code",
            EditorType::Cursor => "cursor",
            EditorType::Zed => "zed",
        }
    }

    /// 表示用のエディタ名を取得
    pub fn display_name(&self) -> &'static str {
        match self {
            EditorType::VsCode => "VS Code",
            EditorType::Cursor => "Cursor",
            EditorType::Zed => "Zed",
        }
    }
}

/// 指定されたエディタでディレクトリを開く
///
/// 対応するコマンド (`code` または `cursor`) がPATHに存在している必要があります。
pub fn open_in_editor(editor: EditorType, path: &Path) -> Result<()> {
    Command::new(editor.command())
        .arg(path)
        .spawn()
        .map_err(GwmError::Io)?;
    Ok(())
}

/// VS Codeでディレクトリを開く
pub fn open_in_vscode(path: &Path) -> Result<()> {
    open_in_editor(EditorType::VsCode, path)
}

/// Cursorエディタでディレクトリを開く
pub fn open_in_cursor(path: &Path) -> Result<()> {
    open_in_editor(EditorType::Cursor, path)
}

/// Zedエディタでディレクトリを開く
pub fn open_in_zed(path: &Path) -> Result<()> {
    open_in_editor(EditorType::Zed, path)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_editor_type_command() {
        assert_eq!(EditorType::VsCode.command(), "code");
        assert_eq!(EditorType::Cursor.command(), "cursor");
        assert_eq!(EditorType::Zed.command(), "zed");
    }

    #[test]
    fn test_editor_type_display_name() {
        assert_eq!(EditorType::VsCode.display_name(), "VS Code");
        assert_eq!(EditorType::Cursor.display_name(), "Cursor");
        assert_eq!(EditorType::Zed.display_name(), "Zed");
    }

    // Note: open_in_vscode, open_in_cursor, open_in_zed の実際のテストは
    // 環境に依存するため、手動テストで確認する
}
