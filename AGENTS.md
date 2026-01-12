# AGENTS.md

AI coding agents向けのプロジェクトガイドライン。

## プロジェクト概要

`gwm` (Git Worktree Manager) - Git worktreeをインタラクティブTUIで管理するCLIツール。

| 実装       | ディレクトリ | フレームワーク | 状態   |
| ---------- | ------------ | -------------- | ------ |
| TypeScript | ルート       | React + Ink    | 安定版 |
| Rust       | `gwm-rust/`  | ratatui        | 開発中 |

Rust版の開発ガイドラインは [gwm-rust/AGENTS.md](./gwm-rust/AGENTS.md) を参照。

## 必須要件

- **Node.js**: 18以上
- **pnpm**: 10以上

---

## 開発コマンド

```bash
pnpm build       # ビルド
pnpm test        # テスト（ウォッチモード）
pnpm test:run    # テスト（1回）
pnpm lint        # リント
pnpm fix         # フォーマット + リント修正
```

## ローカル検証

```bash
pnpm install && pnpm build
node dist/index.js {command}
```

---

## ディレクトリ構成

```
src/
├── index.tsx      # エントリポイント
├── components/    # 各コマンドのReactコンポーネント
├── utils/         # ユーティリティ
├── types/         # 型定義
└── config.ts      # 設定管理
test/              # ユニットテスト
```

---

## CLIコマンド

| コマンド    | エイリアス | 説明             |
| ----------- | ---------- | ---------------- |
| `list`      | `ls`       | ワークツリー一覧 |
| `add`       | -          | 新規作成         |
| `remove`    | `rm`       | 削除             |
| `go`        | -          | 移動（パス出力） |
| `clean`     | -          | マージ済み整理   |
| `pull-main` | -          | main更新         |

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
- **機密情報禁止**: `.env`ファイルや認証情報をコミットしない
- **破壊的変更禁止**: 既存のCLIインターフェースを壊さない

---

## コーディング規約

- ESLint + Prettier設定に従う
- 型は明示的に定義（`any`禁止）
- React Hooksのルールを遵守

---

## テスト

```bash
pnpm test:run              # 全テスト
pnpm test src/utils        # 特定ディレクトリ
```

- テストファイル: `test/**/*.test.ts`
- カバレッジ: `pnpm test:coverage`

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

スコープ例: `feat(gwm-rust): add clean command`

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

| 問題                | 解決策                        |
| ------------------- | ----------------------------- |
| 型エラー            | `pnpm typecheck`で確認        |
| Inkレンダリング問題 | `ink-testing-library`でテスト |
