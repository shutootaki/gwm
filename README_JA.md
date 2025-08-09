<p align="center">
  <a href="README.md">English</a> | <strong>日本語</strong>
</p>

# gwm – Git Worktree Manager

> ⚡ **Git のコンテキストをミリ秒で切り替え**。PR のレビュー、フィーチャーブランチの作成、ワークスペースのクリーンアップまで、すべてを 1 つの対話型 CLI で。

<div align="center">

[![npm version](https://img.shields.io/npm/v/@shutootaki/gwm?color=blue&style=flat-square)](https://www.npmjs.com/package/@shutootaki/gwm)
[![license MIT](https://img.shields.io/badge/license-MIT-green?style=flat-square)](LICENSE)
[![CI](https://github.com/shutootaki/gwm/actions/workflows/ci.yml/badge.svg)](https://github.com/shutootaki/gwm/actions/workflows/ci.yml)
[![Downloads](https://img.shields.io/npm/dm/@shutootaki/gwm?style=flat-square)](https://www.npmjs.com/package/@shutootaki/gwm)

</div>

## 🚀 gwm が便利な理由

複数のプルリクエストやホットフィックスを同時に進めていると、`git checkout` や `git pull` を何度も実行したり、ローカルクローンが散在してしまいがちです。**gwm** は Git のネイティブ機能 _worktree_ を活用し、心地よい UI を提供することで次のことを実現します:

- **⚡ ミリ秒でタスクを切り替え** — stash/checkout のダンスは不要
- **🎯 任意のリモートブランチからワークツリーを一発生成**
- **🧹 ノート PC を常にクリーンに保つ** — 古いブランチを検出し安全に削除
- **🎨 すべてターミナル内で完結** — Ink 製の対話的選択インターフェースを採用

## 📋 主なコマンド一覧

| コマンド                | 役割                                               | ハイライト                                     |
| ----------------------- | -------------------------------------------------- | ---------------------------------------------- |
| `gwm list` / `gwm ls`   | 現在のリポジトリにあるワークツリーを一覧表示       | ステータスの色分け、HEAD ハッシュ              |
| `gwm add`               | 新しいワークツリーを作成                           | 新規ブランチ/リモート PR、対話的バリデーション |
| `gwm go`                | ワークツリーに移動、または VS Code / Cursor で開く | サブシェル起動、エディタフラグ                 |
| `gwm remove` / `gwm rm` | ワークツリーを削除                                 | 複数選択、強制モード、ブランチの後始末         |
| `gwm clean`             | 安全に削除可能なワークツリーを自動検出し一括削除   | Enter で全件削除 / -n でドライラン             |
| `gwm pull-main`         | すべての main 系ワークツリーで `git pull` を実行   | ベースを最新状態に保つ                         |

_注: `gwm help <command>` で各コマンドの詳細を確認できます。_

## 📦 インストール

### npm（推奨）

```bash
# Global install
npm install -g @shutootaki/gwm

# or use npx (no installation needed)
npx @shutootaki/gwm
```

### 代替インストール方法

```bash
# pnpm を使用
pnpm add -g @shutootaki/gwm

# yarn を使用
yarn global add @shutootaki/gwm

# bun を使用
bun add -g @shutootaki/gwm
```

## 🎯 クイックスタート

```bash
# Git リポジトリで
$ gwm add                   # 対話形式: ブランチ名入力 → Enter
$ gwm go feature/my-branch  # ワークツリーにジャンプ
$ gwm go --code             # VS Code を即起動
```

プルリクをレビューする場合:

```bash
$ gwm add 1234-fix-layout -r --code  # リモートブランチからワークツリーを作成し、VS Code を即起動 🚀
```

**週末の大掃除:**

```bash
$ gwm clean             # マージ/削除済みワークツリーを安全に一括削除
```

## 🗂️ デフォルトディレクトリ構成

```
~/git-worktrees/
└─ <repo-name>/
   ├─ main/
   ├─ feature-user-auth/
   └─ hotfix-critical-bug/
```

ベースパスは `~/.config/gwm/config.toml`（または `~/.gwmrc`）で変更できます。

## ⚙️ 設定ファイル

`~/.config/gwm/config.toml` を作成して動作を調整できます:

```toml
# ワークツリーのベースパス（デフォルト: ~/git-worktrees）
worktree_base_path = "/Users/me/dev/worktrees"

# ワークツリー削除時のローカルブランチの扱い
#   "auto"  – 安全なら自動削除
#   "ask"   – 確認プロンプト（デフォルト）
#   "never" – 削除しない
clean_branch = "ask"

# メインワークツリーから gitignore されたファイルをコピー（例: .env ファイル）
# デフォルトでは、gitignoreされたファイルはワークツリーに引き継ぐことはできません。
# この設定を有効にすると、新しく作成するワークツリーにコピーされます。
[copy_ignored_files]
enabled = true  # 機能の有効/無効
patterns = [".env", ".env.*", ".env.local", ".env.*.local"]  # コピー対象
exclude_patterns = [".env.example", ".env.sample"]  # 除外対象
```

## 📖 コマンドリファレンス

以下は主要なコマンドの詳細です。各コマンドで `gwm <command> --help` を実行すると、さらに詳しい情報が確認できます。

### `gwm list` (エイリアス: `ls`)

現在のプロジェクトに存在する worktree を一覧表示します。

```text
STATUS  BRANCH            PATH                              HEAD
*       feature/new-ui    /Users/me/project                 a1b2c3d
M       main              ~/git-worktrees/project/main      123abc4
-       hotfix/logfix     ~/git-worktrees/project/logfix    c7d8e9f
```

- **STATUS の意味:**
  - `* ACTIVE`: あなたが現在いる worktree
  - `M MAIN`: `main` や `master` などのメインブランチ
  - `- OTHER`: その他の worktree

---

### `gwm add [branch_name]`

新しい worktree を作成します。対話的な UI が特徴です。

- **引数なしで実行 (`gwm add`):**
  - 新規ブランチ名を入力する UI が起動します。リアルタイムでブランチ名の妥当性検証とパスのプレビューが表示されます。
  - `Tab` キーを押すと、リモートブランチを選択して worktree を作成するモードに切り替わります（PR のレビューに便利です）。
  - オプションを指定すると、VS Code や Cursor で開くことができます。

- **引数を指定して実行:**
  - `gwm add feature/new-login`: `feature/new-login` という名前で新しいブランチと worktree を作成します。
  - `gwm add existing-branch`: 既存のローカルブランチ `existing-branch` から worktree を作成します。
  - `gwm add pr-branch -r`: リモートブランチ `origin/pr-branch` から worktree を作成します。

- **主なオプション:**
  - `-r, --remote`: リモートブランチから worktree を作成するモードに切り替えます。
  - `--from <base_branch>`: 新規ブランチを作成する際の分岐元を指定します (デフォルト: `main` または `master`)。
  - `--code`: 作成後に VS Code で開きます。
  - `--cursor`: 作成後に Cursor で開きます。
  - `--cd`: 作成後に該当のワークツリーが存在するディレクトリに移動します。

- **gitignore されたファイルの自動コピー:**
  - 設定で `copy_ignored_files` が有効な場合、メインワークツリーから新しいワークツリーに gitignore されたファイル（`.env` ファイルなど）が自動的にコピーされます。
  - これにより、Git で追跡されていない開発環境設定ファイルを手動でコピーする手間が省けます。

---

### `gwm go [query]`

検索で worktree を選択し、そのディレクトリに移動（サブシェルを起動）します。

- `gwm go` で対話的に選択するか、`gwm go feat` のように初期クエリを指定して絞り込めます。
- **主なオプション:**
  - `--code`, `-c`: 選択した worktree を Visual Studio Code で開きます。
  - `--cursor`: 選択した worktree を Cursor で開きます。

---

### `gwm remove [query]` (エイリアス: `rm`)

一つまたは複数の worktree を対話的に選択して削除します。

- `gwm remove` で一覧から複数選択して削除できます。
- **主なオプション:**
  - `-f, --force`: 未コミットの変更があっても強制的に削除します。
  - `--clean-branch <mode>`: worktree と一緒にローカルブランチも削除するかを指定します (`auto` / `ask` / `never`)。

---

### `gwm clean`

安全に削除可能なワークツリーを自動検出し一括削除します。

**削除対象となる worktree の条件:**

1.  リモートブランチが削除済み、またはメインブランチにマージ済み
2.  ローカルでの変更（未コミットや未プッシュのコミット）がない
3.  メインブランチや現在いるブランチではない

- **主なオプション:**
  - `-n, --dry-run`: 一覧表示のみ。削除は行いません。
  - `--force`: 手動確認を省略し即時削除。

---

### `gwm pull-main`

現在地に関わらず、プロジェクトのメインブランチ (`main`, `master` など) の worktree を探し、`git pull` を実行して最新の状態に更新します。

## 🔄 ワークフロー比較

### gwm 導入前（従来の Git）

```bash
# PR をレビューする場合
git stash                    # 現在の作業を退避
git checkout main           # main ブランチに切り替え
git pull                    # main を更新
git checkout pr-branch      # PR ブランチに切り替え
git pull origin pr-branch   # PR ブランチを更新
# ... レビュー作業 ...
git checkout main           # main に戻る
git stash pop               # 作業を復元
```

### gwm 導入後

```bash
# PR をレビューする場合
gwm add pr-branch -r        # リモートからワークツリーを作成
gwm go pr-branch           # レビューに移動
# ... レビュー作業 ... (元の作業には影響なし)
gwm remove pr-branch       # 完了後にクリーンアップ
```

### ヘルプの取得方法

- `gwm help` で一般的なヘルプを表示
- `gwm help <command>` で特定のコマンドのヘルプを表示
- [GitHub Issues](https://github.com/shutootaki/gwm/issues) で既知の問題を確認
- バグを発見した場合は新しい Issue を作成してください

## 📄 ライセンス

MIT © 2024 Shuto Otaki and contributors
