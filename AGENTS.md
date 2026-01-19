# AGENTS.md

AI coding agents向けのプロジェクトガイドライン。

## プロジェクト概要

`gwm` (Git Worktree Manager) - Git worktreeをインタラクティブTUIで管理するCLIツール。

| 実装       | ディレクトリ | フレームワーク | 状態       |
| ---------- | ------------ | -------------- | ---------- |
| Rust       | ルート       | ratatui        | メイン     |
| TypeScript | `gwm-ts/`    | React + Ink    | deprecated |

---

## 開発コマンド

```bash
cargo build            # ビルド
cargo test             # テスト
cargo clippy           # リント
cargo fmt              # フォーマット
make check             # CI相当のチェック
```

## ローカル検証

```bash
cargo build
./target/debug/gwm {command}
```

---

## ディレクトリ構成

```
src/
├── main.rs        # エントリポイント
├── cli/           # CLIコマンド定義
├── config/        # 設定管理
├── git/           # Git操作
├── ui/            # TUIコンポーネント
├── hooks/         # フック実行
└── trust/         # 信頼検証
gwm-ts/            # TypeScript版（deprecated）
```

---

## CLIコマンド

| コマンド | エイリアス  | 説明             |
| -------- | ----------- | ---------------- |
| `list`   | `ls`        | ワークツリー一覧 |
| `add`    | -           | 新規作成         |
| `remove` | `rm`        | 削除             |
| `go`     | -           | 移動（パス出力） |
| `clean`  | -           | マージ済み整理   |
| `sync`   | `pull-main` | main更新         |

---

## 開発ルール

### DO（必須）

- **テストを書く**: 新機能・バグ修正には必ずテストを追加
- **動作確認**: コード変更後はローカルで動作確認
- **UX優先**: ユーザー体験を最優先に設計
- **エラーメッセージ**: 具体的で対処法がわかるメッセージ
- **既存パターン踏襲**: プロジェクト内の既存コードスタイルに従う

### DON'T（禁止）

- **未読のコード変更禁止**: 読んでいないファイルを変更しない
- **過剰な抽象化禁止**: 必要最小限の実装に留める
- **機密情報禁止**: `.env`や認証情報をコミットしない
- **破壊的変更禁止**: 既存のCLIインターフェースを壊さない

---

## コーディング規約

- `cargo clippy`の警告をすべて解消
- `cargo fmt`でフォーマット
- `unwrap()`は避け、適切なエラーハンドリング
- `unsafe`は使用禁止
- `thiserror`/`anyhow`でエラーハンドリング

---

## テスト

```bash
cargo test                 # 全テスト
cargo test git::           # 特定モジュール
cargo test -- --nocapture  # 出力表示
```

---

## コミットメッセージ

Conventional Commits形式:

```
feat: 新機能追加
fix: バグ修正
refactor: リファクタリング
test: テスト追加・修正
docs: ドキュメント
chore: その他
```

スコープ例: `feat(gwm): add clean command`

---

## 設定ファイル

`~/.config/gwm/config.toml`:

```toml
worktree_base_path = "~/git-worktrees"
main_branches = ["main", "master", "develop"]
clean_branch = "ask"  # auto | ask | never

[copy_ignored_files]
enabled = true
patterns = [".env", ".env.*"]

[hooks.post_create]
enabled = true
commands = ["npm install"]
```

---

## トラブルシューティング

| 問題               | 解決策                            |
| ------------------ | --------------------------------- |
| ビルドエラー       | `cargo clean && cargo build`      |
| クリップボード警告 | `cargo clippy --fix`              |
| TUI表示崩れ        | `crossterm`のターミナル互換性確認 |

---

## TypeScript版（deprecated）

TypeScript版は `gwm-ts/` ディレクトリにあり、deprecated です。
新機能の追加は行わず、重大なバグ修正のみ対応します。

### TypeScript版の開発コマンド

```bash
cd gwm-ts
pnpm install
pnpm build       # ビルド
pnpm test:run    # テスト
pnpm lint        # リント
```
