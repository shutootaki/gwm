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
}

impl EditorType {
    /// エディタのコマンド名を取得
    pub fn command(&self) -> &'static str {
        match self {
            EditorType::VsCode => "code",
            EditorType::Cursor => "cursor",
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_editor_type_command() {
        assert_eq!(EditorType::VsCode.command(), "code");
        assert_eq!(EditorType::Cursor.command(), "cursor");
    }

    // Note: open_in_vscode, open_in_cursor の実際のテストは
    // 環境に依存するため、手動テストで確認する
}
