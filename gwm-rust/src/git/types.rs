//! Git関連の型定義
//!
//! Worktreeの状態やメタデータを表現する型を提供します。

use std::path::PathBuf;

use ratatui::style::Color;

/// Worktreeのステータス
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum WorktreeStatus {
    /// 現在アクティブなworktree（カレントディレクトリ）
    Active,
    /// メインworktree（リポジトリのルート、最初のworktree）
    Main,
    /// その他のworktree
    Other,
}

impl WorktreeStatus {
    /// ステータスアイコンを取得
    ///
    /// # Returns
    /// * Active: `*`
    /// * Main: `M`
    /// * Other: `-`
    pub fn icon(&self) -> &'static str {
        match self {
            Self::Active => "*",
            Self::Main => "M",
            Self::Other => "-",
        }
    }

    /// 表示用ラベルを取得
    pub fn label(&self) -> &'static str {
        match self {
            Self::Active => "ACTIVE",
            Self::Main => "MAIN",
            Self::Other => "OTHER",
        }
    }

    /// 表示色を取得（ratatui用）
    pub fn color(&self) -> Color {
        match self {
            Self::Active => Color::Yellow,
            Self::Main => Color::Cyan,
            Self::Other => Color::White,
        }
    }

    /// ANSIエスケープシーケンスのカラーコードを取得
    ///
    /// ターミナル直接出力用のカラーコードを返します。
    pub fn ansi_color(&self) -> &'static str {
        match self {
            Self::Active => "\x1b[33m", // Yellow
            Self::Main => "\x1b[36m",   // Cyan
            Self::Other => "\x1b[37m",  // White
        }
    }

    /// アクティブ時に太字で表示するためのANSIコードを取得
    pub fn ansi_bold_color(&self) -> &'static str {
        match self {
            Self::Active => "\x1b[1;33m", // Bold Yellow
            Self::Main => "\x1b[36m",     // Cyan (not bold)
            Self::Other => "\x1b[37m",    // White (not bold)
        }
    }
}

/// Worktree情報
#[derive(Debug, Clone)]
pub struct Worktree {
    /// ファイルシステム上のパス
    pub path: PathBuf,
    /// ブランチ名（refs/heads/を含む完全参照、またはdetached等の特殊値）
    pub branch: String,
    /// HEADコミットハッシュ（完全形式）
    pub head: String,
    /// ステータス
    pub status: WorktreeStatus,
}

impl Worktree {
    /// ブランチ名を整形して取得（refs/heads/プレフィックスを除去）
    ///
    /// # Example
    /// ```ignore
    /// let wt = Worktree { branch: "refs/heads/feature/test".to_string(), ... };
    /// assert_eq!(wt.display_branch(), "feature/test");
    /// ```
    pub fn display_branch(&self) -> &str {
        self.branch
            .strip_prefix("refs/heads/")
            .unwrap_or(&self.branch)
    }

    /// HEADの短縮形を取得（最初の7文字）
    ///
    /// # Example
    /// ```ignore
    /// let wt = Worktree { head: "abc1234567890".to_string(), ... };
    /// assert_eq!(wt.short_head(), "abc1234");
    /// ```
    pub fn short_head(&self) -> &str {
        if self.head.len() > 7 {
            &self.head[..7]
        } else {
            &self.head
        }
    }
}

/// git pull の結果（Phase 3以降で使用）
#[derive(Debug, Clone)]
pub struct PullResult {
    /// ブランチ名
    pub branch: String,
    /// Worktreeパス
    pub path: PathBuf,
    /// 成功したかどうか
    pub success: bool,
    /// 結果メッセージ
    pub message: String,
}

/// クリーンアップ理由
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CleanReason {
    /// リモートブランチが削除された
    RemoteDeleted,
    /// メインブランチにマージ済み
    Merged,
}

impl CleanReason {
    /// 表示用ラベルを取得
    pub fn label(&self) -> &'static str {
        match self {
            Self::RemoteDeleted => "remote deleted",
            Self::Merged => "merged",
        }
    }

    /// 詳細メッセージを取得
    pub fn description(&self) -> &'static str {
        match self {
            Self::RemoteDeleted => "Remote branch has been deleted",
            Self::Merged => "Branch has been merged into main",
        }
    }

    /// ANSIカラーコードを取得
    pub fn ansi_color(&self) -> &'static str {
        match self {
            Self::RemoteDeleted => "\x1b[31m", // Red
            Self::Merged => "\x1b[32m",        // Green
        }
    }
}

/// クリーンアップ可能なworktree
#[derive(Debug, Clone)]
pub struct CleanableWorktree {
    /// 対象worktree
    pub worktree: Worktree,
    /// クリーンアップ理由
    pub reason: CleanReason,
    /// マージ先ブランチ（マージ済みの場合）
    pub merged_into: Option<String>,
}

impl CleanableWorktree {
    /// 表示用の理由テキストを取得
    pub fn reason_text(&self) -> String {
        match self.reason {
            CleanReason::RemoteDeleted => "remote deleted".to_string(),
            CleanReason::Merged => {
                if let Some(ref target) = self.merged_into {
                    format!("merged into {}", target)
                } else {
                    "merged".to_string()
                }
            }
        }
    }
}

/// ローカル変更情報
#[derive(Debug, Default)]
pub struct LocalChanges {
    /// ステージされていない変更があるか
    pub has_unstaged_changes: bool,
    /// 追跡されていないファイルがあるか
    pub has_untracked_files: bool,
    /// ステージされた変更があるか
    pub has_staged_changes: bool,
    /// ローカルにしかないコミットがあるか
    pub has_local_commits: bool,
}

impl LocalChanges {
    /// 何らかの変更があるかどうか
    pub fn has_any(&self) -> bool {
        self.has_unstaged_changes
            || self.has_untracked_files
            || self.has_staged_changes
            || self.has_local_commits
    }

    /// 変更の概要を文字列で取得
    pub fn summary(&self) -> Vec<String> {
        let mut items = Vec::new();
        if self.has_staged_changes {
            items.push("staged changes".to_string());
        }
        if self.has_unstaged_changes {
            items.push("unstaged changes".to_string());
        }
        if self.has_untracked_files {
            items.push("untracked files".to_string());
        }
        if self.has_local_commits {
            items.push("unpushed commits".to_string());
        }
        items
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_worktree_status_icon() {
        assert_eq!(WorktreeStatus::Active.icon(), "*");
        assert_eq!(WorktreeStatus::Main.icon(), "M");
        assert_eq!(WorktreeStatus::Other.icon(), "-");
    }

    #[test]
    fn test_worktree_status_label() {
        assert_eq!(WorktreeStatus::Active.label(), "ACTIVE");
        assert_eq!(WorktreeStatus::Main.label(), "MAIN");
        assert_eq!(WorktreeStatus::Other.label(), "OTHER");
    }

    #[test]
    fn test_worktree_status_color() {
        assert_eq!(WorktreeStatus::Active.color(), Color::Yellow);
        assert_eq!(WorktreeStatus::Main.color(), Color::Cyan);
        assert_eq!(WorktreeStatus::Other.color(), Color::White);
    }

    #[test]
    fn test_worktree_status_ansi_color() {
        assert_eq!(WorktreeStatus::Active.ansi_color(), "\x1b[33m");
        assert_eq!(WorktreeStatus::Main.ansi_color(), "\x1b[36m");
        assert_eq!(WorktreeStatus::Other.ansi_color(), "\x1b[37m");
    }

    #[test]
    fn test_worktree_status_ansi_bold_color() {
        assert_eq!(WorktreeStatus::Active.ansi_bold_color(), "\x1b[1;33m");
        assert_eq!(WorktreeStatus::Main.ansi_bold_color(), "\x1b[36m");
        assert_eq!(WorktreeStatus::Other.ansi_bold_color(), "\x1b[37m");
    }

    #[test]
    fn test_display_branch_with_refs_prefix() {
        let worktree = Worktree {
            path: PathBuf::from("/test"),
            branch: "refs/heads/feature/test".to_string(),
            head: "abc1234".to_string(),
            status: WorktreeStatus::Other,
        };
        assert_eq!(worktree.display_branch(), "feature/test");
    }

    #[test]
    fn test_display_branch_without_prefix() {
        let worktree = Worktree {
            path: PathBuf::from("/test"),
            branch: "(detached)".to_string(),
            head: "abc1234".to_string(),
            status: WorktreeStatus::Other,
        };
        assert_eq!(worktree.display_branch(), "(detached)");
    }

    #[test]
    fn test_short_head_long() {
        let worktree = Worktree {
            path: PathBuf::from("/test"),
            branch: "main".to_string(),
            head: "abc1234567890".to_string(),
            status: WorktreeStatus::Main,
        };
        assert_eq!(worktree.short_head(), "abc1234");
    }

    #[test]
    fn test_short_head_short() {
        let worktree = Worktree {
            path: PathBuf::from("/test"),
            branch: "main".to_string(),
            head: "abc".to_string(),
            status: WorktreeStatus::Main,
        };
        assert_eq!(worktree.short_head(), "abc");
    }

    #[test]
    fn test_short_head_exact_seven() {
        let worktree = Worktree {
            path: PathBuf::from("/test"),
            branch: "main".to_string(),
            head: "abc1234".to_string(),
            status: WorktreeStatus::Main,
        };
        assert_eq!(worktree.short_head(), "abc1234");
    }
}
