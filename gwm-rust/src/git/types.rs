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
    /// ステータス（表示用）
    pub status: WorktreeStatus,
    /// メインworktreeかどうか（統計用、statusとは独立）
    pub is_main: bool,
    /// リモートとの同期状態
    pub sync_status: Option<SyncStatus>,
    /// ワーキングディレクトリの変更状態
    pub change_status: Option<ChangeStatus>,
    /// 最終更新時間（相対表示用）
    pub last_activity: Option<String>,
    /// 最終コミット日時（ISO8601形式）
    pub commit_date: Option<String>,
    /// 最終コミッター名
    pub committer_name: Option<String>,
    /// 最終コミットメッセージ
    pub commit_message: Option<String>,
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

    /// 表示色を取得（ratatui用）
    pub fn color(&self) -> Color {
        match self {
            Self::RemoteDeleted => Color::Red,
            Self::Merged => Color::Green,
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

/// リモートとの同期状態
#[derive(Debug, Clone, Default)]
pub struct SyncStatus {
    /// リモートより先行しているコミット数
    pub ahead: usize,
    /// リモートより遅れているコミット数
    pub behind: usize,
}

impl SyncStatus {
    /// 同期済みかどうか
    pub fn is_synced(&self) -> bool {
        self.ahead == 0 && self.behind == 0
    }

    /// 表示用文字列を取得
    pub fn display(&self) -> String {
        if self.is_synced() {
            "✓".to_string()
        } else {
            format!("↑{} ↓{}", self.ahead, self.behind)
        }
    }
}

/// 変更されたファイル情報
#[derive(Debug, Clone)]
pub struct ChangedFile {
    /// ステータス文字 (M, A, D, ?)
    pub status: char,
    /// ファイルパス
    pub path: String,
}

impl ChangedFile {
    /// ステータスに応じた表示色を取得
    pub fn status_color(&self) -> Color {
        match self.status {
            'M' => Color::Yellow,
            'A' => Color::Green,
            'D' => Color::Red,
            '?' => Color::Magenta,
            _ => Color::White,
        }
    }
}

/// ワーキングディレクトリの変更状態
#[derive(Debug, Clone, Default)]
pub struct ChangeStatus {
    /// 変更されたファイル数
    pub modified: usize,
    /// 追加されたファイル数
    pub added: usize,
    /// 削除されたファイル数
    pub deleted: usize,
    /// 追跡されていないファイル数
    pub untracked: usize,
    /// 変更ファイル一覧（最大5件）
    pub changed_files: Vec<ChangedFile>,
}

impl ChangeStatus {
    /// クリーンな状態かどうか
    pub fn is_clean(&self) -> bool {
        self.modified == 0 && self.added == 0 && self.deleted == 0 && self.untracked == 0
    }

    /// 表示用文字列を取得
    pub fn display(&self) -> String {
        if self.is_clean() {
            "clean".to_string()
        } else {
            let mut parts = Vec::new();
            if self.modified > 0 {
                parts.push(format!("{}M", self.modified));
            }
            if self.added > 0 {
                parts.push(format!("{}A", self.added));
            }
            if self.deleted > 0 {
                parts.push(format!("{}D", self.deleted));
            }
            if self.untracked > 0 {
                parts.push(format!("{}U", self.untracked));
            }
            parts.join(" ")
        }
    }

    /// ステータスラベルを取得（Clean/Modified/Untracked）
    pub fn status_label(&self) -> &'static str {
        if self.is_clean() {
            "Clean"
        } else if self.untracked > 0 && self.modified == 0 && self.added == 0 && self.deleted == 0 {
            "Untracked"
        } else {
            "Modified"
        }
    }

    /// ステータスに応じた表示色を取得
    pub fn status_color(&self) -> Color {
        if self.is_clean() {
            Color::Green
        } else if self.untracked > 0 && self.modified == 0 && self.added == 0 && self.deleted == 0 {
            Color::Red
        } else {
            Color::Yellow
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
            is_main: false,
            sync_status: None,
            change_status: None,
            last_activity: None,
            commit_date: None,
            committer_name: None,
            commit_message: None,
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
            is_main: false,
            sync_status: None,
            change_status: None,
            last_activity: None,
            commit_date: None,
            committer_name: None,
            commit_message: None,
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
            is_main: true,
            sync_status: None,
            change_status: None,
            last_activity: None,
            commit_date: None,
            committer_name: None,
            commit_message: None,
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
            is_main: true,
            sync_status: None,
            change_status: None,
            last_activity: None,
            commit_date: None,
            committer_name: None,
            commit_message: None,
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
            is_main: true,
            sync_status: None,
            change_status: None,
            last_activity: None,
            commit_date: None,
            committer_name: None,
            commit_message: None,
        };
        assert_eq!(worktree.short_head(), "abc1234");
    }

    #[test]
    fn test_sync_status_display() {
        let synced = SyncStatus {
            ahead: 0,
            behind: 0,
        };
        assert!(synced.is_synced());
        assert_eq!(synced.display(), "✓");

        let not_synced = SyncStatus {
            ahead: 2,
            behind: 3,
        };
        assert!(!not_synced.is_synced());
        assert_eq!(not_synced.display(), "↑2 ↓3");
    }

    #[test]
    fn test_change_status_display() {
        let clean = ChangeStatus::default();
        assert!(clean.is_clean());
        assert_eq!(clean.display(), "clean");

        let with_changes = ChangeStatus {
            modified: 3,
            added: 1,
            deleted: 2,
            untracked: 0,
            changed_files: vec![],
        };
        assert!(!with_changes.is_clean());
        assert_eq!(with_changes.display(), "3M 1A 2D");
    }

    #[test]
    fn test_change_status_label_and_color() {
        // Clean状態
        let clean = ChangeStatus::default();
        assert_eq!(clean.status_label(), "Clean");
        assert_eq!(clean.status_color(), Color::Green);

        // Modified状態（変更あり）
        let modified = ChangeStatus {
            modified: 1,
            added: 0,
            deleted: 0,
            untracked: 0,
            changed_files: vec![],
        };
        assert_eq!(modified.status_label(), "Modified");
        assert_eq!(modified.status_color(), Color::Yellow);

        // Untracked状態（untrackedのみ）
        let untracked = ChangeStatus {
            modified: 0,
            added: 0,
            deleted: 0,
            untracked: 2,
            changed_files: vec![],
        };
        assert_eq!(untracked.status_label(), "Untracked");
        assert_eq!(untracked.status_color(), Color::Red);

        // 混合状態（Modified優先）
        let mixed = ChangeStatus {
            modified: 1,
            added: 0,
            deleted: 0,
            untracked: 1,
            changed_files: vec![],
        };
        assert_eq!(mixed.status_label(), "Modified");
        assert_eq!(mixed.status_color(), Color::Yellow);
    }

    #[test]
    fn test_changed_file_status_color() {
        assert_eq!(
            ChangedFile {
                status: 'M',
                path: "test.rs".to_string()
            }
            .status_color(),
            Color::Yellow
        );
        assert_eq!(
            ChangedFile {
                status: 'A',
                path: "new.rs".to_string()
            }
            .status_color(),
            Color::Green
        );
        assert_eq!(
            ChangedFile {
                status: 'D',
                path: "deleted.rs".to_string()
            }
            .status_color(),
            Color::Red
        );
        assert_eq!(
            ChangedFile {
                status: '?',
                path: "untracked.rs".to_string()
            }
            .status_color(),
            Color::Magenta
        );
    }
}
