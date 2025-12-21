<p align="center">
  <a href="README.md">English</a> | <strong>日本語</strong>
</p>

# gwm – Git Worktree Manager

Git worktree を使って、複数ブランチを同時に扱える CLI ツールです。

<div align="center">

[![npm version](https://img.shields.io/npm/v/@shutootaki/gwm?color=blue&style=flat-square)](https://www.npmjs.com/package/@shutootaki/gwm)
[![license MIT](https://img.shields.io/badge/license-MIT-green?style=flat-square)](LICENSE)
[![CI](https://github.com/shutootaki/gwm/actions/workflows/ci.yml/badge.svg)](https://github.com/shutootaki/gwm/actions/workflows/ci.yml)
[![Downloads](https://img.shields.io/npm/dm/@shutootaki/gwm?style=flat-square)](https://www.npmjs.com/package/@shutootaki/gwm)

</div>

## gwm が解決する問題

複数の PR をレビューしたり、hotfix を作りながら別の機能を開発していると、`git stash` と `git checkout` を繰り返すことになります。gwm は Git の worktree 機能を使って、**ブランチごとに独立したディレクトリを管理**します。

- stash せずにブランチを切り替えられる
- リモートブランチからすぐに worktree を作成できる
- マージ済みの worktree を自動検出して削除できる

## コマンド一覧

| コマンド                | 説明                                            |
| ----------------------- | ----------------------------------------------- |
| `gwm list` / `gwm ls`   | worktree を一覧表示                             |
| `gwm add`               | 新しい worktree を作成                          |
| `gwm go`                | worktree に移動、または VS Code / Cursor で開く |
| `gwm remove` / `gwm rm` | worktree を削除                                 |
| `gwm clean`             | マージ済み worktree を検出して削除              |
| `gwm pull-main`         | main 系 worktree で `git pull` を実行           |

`gwm help <command>` で各コマンドの詳細を確認できます。

## インストール

```bash
npm install -g @shutootaki/gwm

# インストールせずに試す
npx @shutootaki/gwm
```

## 使用例

**新しいブランチで作業を始める:**

```bash
gwm add feature/new-login --code  # worktree を作成して、VS Code で開く
```

**PR をレビューする:**

```bash
gwm add fix-bug -r --code    # リモートブランチから worktree を作成し VS Code で開く
# レビュー後
gwm remove fix-bug           # 削除
```

**不要な worktree を掃除する:**

```bash
gwm clean                    # マージ済み worktree を検出して削除
```

## ディレクトリ構成

worktree は以下の場所に作成されます:

```
~/git-worktrees/<リポジトリ名>/<ブランチ名>/
```

例: `~/git-worktrees/my-app/feature-login/`

## 設定ファイル

`~/.config/gwm/config.toml` で動作をカスタマイズできます。

### 設定項目一覧

| 項目                                  | 説明                                          | デフォルト値         |
| ------------------------------------- | --------------------------------------------- | -------------------- |
| `worktree_base_path`                  | worktree を作成するディレクトリ               | `~/git-worktrees`    |
| `main_branches`                       | メインブランチとして扱うブランチ名            | `["main", "master"]` |
| `clean_branch`                        | worktree 削除時にローカルブランチも削除するか | `"ask"`              |
| `copy_ignored_files.enabled`          | gitignore されたファイルをコピーするか        | `false`              |
| `copy_ignored_files.patterns`         | コピー対象のファイルパターン                  | `[]`                 |
| `copy_ignored_files.exclude_patterns` | コピーから除外するファイルパターン            | `[]`                 |
| `hooks.post_create.enabled`           | worktree 作成後に hooks を実行するか          | `true`               |
| `hooks.post_create.commands`          | 作成後に実行するコマンドの配列                | `[]`                 |

**`clean_branch` の値:**

- `"auto"`: 安全なら自動削除
- `"ask"`: 確認する（デフォルト）
- `"never"`: 削除しない

### 設定例

```toml
worktree_base_path = "/Users/me/worktrees"
clean_branch = "ask"

[copy_ignored_files]
enabled = true
patterns = [".env", ".env.*", ".env.local"]
exclude_patterns = [".env.example", ".env.sample"]

[hooks.post_create]
commands = ["npm install"]
```

### プロジェクト固有の設定

リポジトリ内に `gwm/config.toml` を作成すると、そのプロジェクト専用の設定を定義できます。グローバル設定をベースに、プロジェクト設定で上書きされます。

**例: このプロジェクトでは pnpm を使いたい場合**

`my-project/gwm/config.toml`:

```toml
[hooks.post_create]
commands = ["pnpm install"]
```

### Hook で使える環境変数

`post_create` hooks 実行時に、以下の環境変数が利用可能です:

| 変数                | 内容                       |
| ------------------- | -------------------------- |
| `GWM_WORKTREE_PATH` | 新しい worktree の絶対パス |
| `GWM_BRANCH_NAME`   | ブランチ名                 |
| `GWM_REPO_ROOT`     | Git リポジトリのルートパス |
| `GWM_REPO_NAME`     | リポジトリ名               |

## コマンド詳細

### `gwm list` (エイリアス: `ls`)

現在のプロジェクトに存在する worktree を一覧表示します。

```text
STATUS  BRANCH            PATH                              HEAD
*       feature/new-ui    /Users/me/project                 a1b2c3d
M       main              ~/git-worktrees/project/main      123abc4
-       hotfix/logfix     ~/git-worktrees/project/logfix    c7d8e9f
```

**STATUS の意味:**

- `* ACTIVE`: 現在いる worktree
- `M MAIN`: main や master などのメインブランチ
- `- OTHER`: その他の worktree

---

### `gwm add [branch_name]`

新しい worktree を作成します。

**引数なしで実行 (`gwm add`):**

- 新規ブランチ名を入力する UI が起動します
- `Tab` キーでリモートブランチ選択モードに切り替え可能

**引数を指定して実行:**

- `gwm add feature/new-login`: 新しいブランチと worktree を作成
- `gwm add existing-branch`: 既存のローカルブランチから worktree を作成
- `gwm add pr-branch -r`: リモートブランチから worktree を作成

**オプション:**

| オプション        | 説明                                           |
| ----------------- | ---------------------------------------------- |
| `-r, --remote`    | リモートブランチから作成                       |
| `--from <branch>` | 分岐元を指定（デフォルト: main または master） |
| `--code`          | 作成後に VS Code で開く                        |
| `--cursor`        | 作成後に Cursor で開く                         |
| `--cd`            | 作成後にそのディレクトリに移動（シェル連携用） |
| `--skip-hooks`    | post_create hooks の実行をスキップ             |

**gitignore されたファイルの自動コピー:**

設定で `copy_ignored_files` が有効な場合、メイン worktree から新しい worktree に `.env` ファイルなどが自動的にコピーされます。

---

### `gwm go [query]`

worktree を選択してそのディレクトリに移動します（サブシェルを起動）。

- `gwm go`: 対話的に選択
- `gwm go feat`: "feat" で絞り込んで選択

**オプション:**

| オプション   | 説明           |
| ------------ | -------------- |
| `-c, --code` | VS Code で開く |
| `--cursor`   | Cursor で開く  |

---

### `gwm remove [query]` (エイリアス: `rm`)

worktree を対話的に選択して削除します。複数選択可能。

**オプション:**

| オプション              | 説明                                              |
| ----------------------- | ------------------------------------------------- |
| `-f, --force`           | 未コミットの変更があっても強制削除                |
| `--clean-branch <mode>` | ローカルブランチも削除 (`auto` / `ask` / `never`) |

---

### `gwm clean`

安全に削除可能な worktree を自動検出して削除します。

**削除対象となる条件:**

1. リモートブランチが削除済み、またはメインブランチにマージ済み
2. ローカルに未コミットや未プッシュのコミットがない
3. メインブランチや現在いる worktree ではない

**オプション:**

| オプション      | 説明                   |
| --------------- | ---------------------- |
| `-n, --dry-run` | 削除せずに一覧表示のみ |
| `--force`       | 確認なしで即時削除     |

---

### `gwm pull-main`

プロジェクトのメインブランチ（main, master など）の worktree を探し、`git pull` を実行して最新状態に更新します。現在地がどこであっても実行可能です。

## ワークフロー比較

### 従来の Git

```bash
# PR をレビューする場合
git stash                    # 現在の作業を退避
git checkout main            # main に切り替え
git pull                     # main を更新
git checkout pr-branch       # PR ブランチに切り替え
git pull origin pr-branch    # PR ブランチを更新
# ... レビュー作業 ...
git checkout main            # main に戻る
git stash pop                # 作業を復元
```

### gwm を使う場合

```bash
# PR をレビューする場合
gwm add pr-branch -r         # リモートから worktree を作成
gwm go pr-branch             # レビュー用 worktree に移動
# ... レビュー作業 ... (元の作業には影響なし)
gwm remove pr-branch         # 完了後に削除
```

## ヘルプ

- `gwm help`: 一般的なヘルプを表示
- `gwm help <command>`: 特定のコマンドのヘルプを表示
- [GitHub Issues](https://github.com/shutootaki/gwm/issues): バグ報告・機能要望

## ライセンス

MIT
