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
- **ステータス分類**: 3分類ステータスシステム（Active/Main/Other）
- **シェル統合**: シェル関数によるシームレスなディレクトリナビゲーション
- **VS Code統合**: エディタでworktreeを直接開く機能
- **柔軟な設定**: TOMLファイルでベースパスとメインブランチをカスタマイズ
- **TypeScript & React**: 保守可能で拡張可能なコードのためのモダンな技術

## インストール

### 前提条件

- Node.js 16+
- Git 2.25+

### npmから（近日公開予定）

```bash
npm install -g gwm
```

### ソースから

```bash
git clone https://github.com/shutootaki/gwm.git
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

- `* ACTIVE`: 現在アクティブなworktree（黄色）
- `M MAIN`: ベースとなるメインworktree（シアン）
- `- OTHER`: その他のすべてのworktree（白）

### `gwm add [branch_name]`

ブランチから新しいworktreeを作成します。引数なしの場合、インタラクティブなリモートブランチ選択を起動します。

```bash
# インタラクティブモード - リモートブランチから選択
gwm add

# ローカルブランチから作成（存在しない場合は新規ブランチ）
gwm add feature/new-ui

# リモートブランチから作成
gwm add -r feature/api-update

# 特定のベースから新しいブランチを作成
gwm add new-feature --from main
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

### `gwm go [query]`

worktreeディレクトリに移動します。シェル統合用に設計されています。

```bash
# インタラクティブ選択
gwm go

# 事前フィルタリング選択
gwm go feature

# VS Codeでworktreeを開く
gwm go api-refactor --code

# Cursorでworktreeを開く
gwm go bugfix/login --cursor
```

### `gwm pull-main`

カレントディレクトリがworktreeディレクトリ以外の場所にある場合でも、メインブランチのworktreeを最新の状態に更新します。

```bash
# メインブランチの更新
gwm pull-main
```

**使用ケース:**

- worktreeファイルが特定のディレクトリ（例: `~/username/git-worktree`）にあり、ベースのworktreeに直接mainブランチを最新状態に更新できない場合

### `gwm help [command]`

gwmの使い方や各コマンドの詳細情報を表示します。

```bash
# 全般的なヘルプを表示
gwm help
gwm --help
gwm -h

# 特定のコマンドのヘルプを表示
gwm help add
gwm add --help
gwm add -h
```

**使用例:**

```bash
# gwmで利用可能なすべてのコマンドを表示
gwm help

# addコマンドの詳細な使い方とオプションを表示
gwm help add

# removeコマンドのヘルプを表示
gwm help remove
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
gwm add -r feature/new-dashboard

# 機能の作業...

# worktree間をナビゲート
wgo main        # mainブランチに切り替え
wgo dashboard   # 機能ブランチに戻る

# VS Codeで別のworktreeを開く
gwm go api-refactor --code

# 完了時のクリーンアップ
gwm clean       # インタラクティブクリーンアップ
gwm remove      # 特定のworktreeを削除
```

### コマンド例

```bash
# 新しいworktree用のインタラクティブブランチ選択
gwm add

# リモートブランチからworktreeを作成
gwm add -r hotfix/critical-bug

# mainから新しい機能ブランチを作成
gwm add new-feature --from main

# 複数選択によるworktree削除
gwm remove feature

# マージ済みブランチの自動クリーンアップ
gwm clean -y

# メインブランチの更新
gwm pull-main

# ファジーサーチによる素早いナビゲーション
wgo dash        # "feature-dashboard"にマッチ
```

## 開発

### セットアップ

```bash
git clone https://github.com/shutootaki/gwm.git
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
