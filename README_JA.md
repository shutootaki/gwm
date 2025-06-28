# gwm - Git Worktree Manager

InkベースのインタラクティブなReact端末UIを備えた、効率的なGit worktree管理のためのモダンなCLIツールです。

## 概要

`gwm`は以下のニーズを持つ開発者のためのGit worktree管理を簡素化します：

- GitHub プルリクエストのローカルでのレビューとテストを、素早いコンテキスト切り替えで実現
- クリーンで独立した環境で複数の機能開発やバグ修正を並行して実行
- リモートブランチからのworktree作成とマージされたブランチのクリーンアップを自動化

## 特徴

- **インタラクティブUI**: すべての操作でfzfライクなファジーサーチと複数選択機能
- **直感的なコマンド**: 一貫した動作を持つシンプルで単一目的のコマンド
- **スマートなステータス検出**: マージ済み、削除済み、削除可能なworktreeを自動識別
- **シェル統合**: シェル関数によるシームレスなディレクトリナビゲーション
- **VS Code統合**: エディタでworktreeを直接開く機能
- **柔軟な設定**: TOMLファイルでベースパスとメインブランチをカスタマイズ
- **TypeScript & React**: 保守可能で拡張可能なコードのためのモダンな技術

## インストール

### 前提条件

- Node.js 16+
- Git 2.25+
- VS Code（オプション、`gwm code`コマンド用）

### npmから（近日公開予定）

```bash
npm install -g gwm
```

### ソースから

```bash
git clone https://github.com/your-username/gwm.git
cd gwm
pnpm install
pnpm build
pnpm link --global
```

## コマンド

### `gwm list`（エイリアス: `ls`）

すべてのworktreeをステータス、ブランチ、パス、コミット情報と共に表示します。

```bash
gwm list
```

**ステータスインジケータ:**

- `* ACTIVE`: 現在アクティブなworktree
- `NORMAL`: 通常のworktree
- `PRUNABLE`: マージ済みまたは削除されたブランチ（クリーンアップ候補）
- `LOCKED`: Gitロックされたworktree

### `gwm create [branch_name]`

ブランチから新しいworktreeを作成します。引数なしの場合、インタラクティブなリモートブランチ選択を起動します。

```bash
# インタラクティブモード - リモートブランチから選択
gwm create

# ローカルブランチから作成（存在しない場合は新規ブランチ）
gwm create feature/new-ui

# リモートブランチから作成
gwm create -r feature/api-update

# 特定のベースから新しいブランチを作成
gwm create new-feature --from main
```

**オプション:**

- `-r, --remote`: branch_nameをリモートブランチとして扱う（フェッチして追跡）
- `--from <branch>`: 新規ブランチ作成の基点ブランチを指定（デフォルトはmain）

### `gwm remove`（エイリアス: `rm`）

インタラクティブな複数選択で1つまたは複数のworktreeを削除します。

```bash
# インタラクティブ選択
gwm remove

# クエリで事前フィルタリング
gwm remove feature

# 強制削除
gwm remove -f
```

**オプション:**

- `-f, --force`: 未コミットの変更があっても強制削除

### `gwm clean`

マージ済みまたは削除されたworktreeをクリーンアップします。メインブランチにマージされたブランチやリモートから削除されたブランチのworktreeを識別します。

```bash
# 複数選択によるインタラクティブクリーンアップ
gwm clean

# 検出されたすべての候補を自動クリーンアップ
gwm clean -y
```

**検出条件:**

- ブランチが設定されたメインブランチのいずれかにマージ済み
- リモート追跡ブランチが存在しない

**オプション:**

- `-y, --yes`: インタラクティブ選択をスキップして検出されたすべての候補を削除

### `gwm go [query]`

worktreeディレクトリに移動します。シェル統合用に設計されています。

```bash
# インタラクティブ選択
gwm go

# 事前フィルタリング選択
gwm go feature
```

### `gwm code [query]`

選択したworktreeをVisual Studio Codeで開きます。

```bash
# インタラクティブ選択
gwm code

# 事前フィルタリング選択
gwm code feature
```

## シェル統合

シームレスなナビゲーションのために、`~/.zshrc`または`~/.bashrc`にこの関数を追加してください：

```bash
function wgo() {
  local path
  path="$(gwm go "$1")"
  if [ -n "$path" ]; then
    cd "$path"
  fi
}
```

使用法:

```bash
wgo feature  # "feature"にマッチするworktreeに移動
wgo          # インタラクティブ選択
```

## 設定

`~/.config/gwm/config.toml`に設定ファイルを作成してください：

```toml
# worktreeのベースディレクトリ（デフォルト: ~/worktrees）
worktree_base_path = "/Users/myuser/dev/worktrees"

# マージ検出とデフォルトベース用のメインブランチ（デフォルト: ["main", "master", "develop"]）
main_branches = ["main", "master", "develop"]
```

### Worktreeパス規則

Worktreeは以下のパターンで作成されます：

```
<worktree_base_path>/<repository-name>/<normalized-branch-name>
```

**ブランチ名の正規化:**

- ファイルシステム互換性のためスラッシュがハイフンに変換されます
- 例:
  - `feature/user-auth` → `feature-user-auth`
  - `hotfix/critical-bug` → `hotfix-critical-bug`

**パス例:**

```
~/worktrees/myproject/main
~/worktrees/myproject/feature-user-auth
~/worktrees/myproject/hotfix-critical-bug
```

## 使用例

### 典型的なワークフロー

```bash
# 現在のworktreeを一覧表示
gwm list

# PRレビュー用のworktreeを作成
gwm create -r feature/new-dashboard

# 機能の作業...

# worktree間をナビゲート
wgo main        # mainブランチに切り替え
wgo dashboard   # 機能ブランチに戻る

# VS Codeで別のworktreeを開く
gwm code api-refactor

# 完了時のクリーンアップ
gwm clean       # インタラクティブクリーンアップ
gwm remove      # 特定のworktreeを削除
```

### コマンド例

```bash
# 新しいworktree用のインタラクティブブランチ選択
gwm create

# リモートブランチからworktreeを作成
gwm create -r hotfix/critical-bug

# mainから新しい機能ブランチを作成
gwm create new-feature --from main

# 複数選択によるworktree削除
gwm remove feature

# マージ済みブランチの自動クリーンアップ
gwm clean -y

# ファジーサーチによる素早いナビゲーション
wgo dash        # "feature-dashboard"にマッチ
```

## 開発

### セットアップ

```bash
git clone https://github.com/your-username/gwm.git
cd gwm
pnpm install
```

### 利用可能なスクリプト

```bash
pnpm dev                # ウォッチモードコンパイル
pnpm build              # TypeScriptコンパイル
pnpm start              # コンパイル済みCLIを実行
pnpm test               # Vitestでテスト実行
pnpm test:coverage      # カバレッジレポート生成
pnpm test:ui            # Vitest UIを起動
pnpm lint               # ESLintチェック
pnpm lint:fix           # ESLint修正
pnpm format             # Prettierフォーマット
```

### ローカルテスト

```bash
pnpm build
pnpm link --global
gwm --help              # CLIをテスト
```

### アーキテクチャ

- **エントリーポイント**: `src/index.tsx` - コマンドルーティングと引数パース
- **コンポーネント**: `src/components/` - 各コマンドのUI用Reactコンポーネント
- **ユーティリティ**: `src/utils/` - Git操作、CLI解析、フォーマットヘルパー
- **型定義**: `src/types/` - TypeScript型定義
- **設定**: `src/config.ts` - 設定ファイル処理
- **テスト**: `test/` - ユーティリティとコンポーネントのユニットテスト

## 貢献

1. リポジトリをフォーク
2. 機能ブランチを作成（`git checkout -b feature/amazing-feature`）
3. 変更をコミット（`git commit -m 'Add amazing feature'`）
4. ブランチにプッシュ（`git push origin feature/amazing-feature`）
5. プルリクエストを開く

## ライセンス

MIT License - 詳細は[LICENSE](LICENSE)ファイルを参照してください。

## 謝辞

- React ベースCLIインターフェース用の[Ink](https://github.com/vadimdemedes/ink)で構築
- モダンなGitワークフローツールと`fzf`のユーザーエクスペリエンスにインスパイア
