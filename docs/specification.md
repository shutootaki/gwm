# CLI ツール `wtm` 開発仕様書

## 1\. 概要 (Overview)

### 1.1. ツール名

`wtm` (worktree manager の略)

### 1.2. 目的

`git worktree` の管理・運用を効率化し、以下の主要なユースケースをサポートする。

- GitHub のプルリクエストのレビューや修正を、ローカルで迅速に切り替えて行う。
- 複数の機能開発やバグ修正を、クリーンな状態で並行して進める。

### 1.3. コアコンセプト

- **単一責任コマンド:** 各コマンドは一つの明確な責務を持つ。
- **対話的 UI の優先:** 引数なしで実行された場合、`fzf`ライクなファジーサーチと選択 UI を提供し、ユーザーの記憶やタイピングの負担を軽減する。
- **自動化による効率化:** リモートブランチからの worktree 作成や、古い worktree の掃除など、複数ステップの操作を自動化する。

## 2\. グローバル仕様 (Global Specifications)

### 2.1. コマンド体系

基本的なコマンド体系は `wtm <command> [arguments] [options]` とする。

### 2.2. Worktree の作成場所

- **デフォルトパス:** 新しい worktree は `~/worktrees/<repository-name>/<branch-name>` に作成される。
  - `<repository-name>` は Git リポジトリのディレクトリ名。
  - `<branch-name>` は `feature/user-auth` のようなスラッシュを含むブランチの場合、`feature-user-auth` のようにハイフンに変換される。
- **設定によるカスタマイズ:** ユーザーは設定ファイルでベースパス (`~/worktrees`) を変更できる。

### 2.3. 対話的インターフェース (Interactive UI)

- 各コマンドで worktree の選択が必要な場合（例: `wtm go`, `wtm rm`）、引数がなければ対話的 UI を起動する。
- UI には worktree の一覧が整形されて表示され、ユーザーはカーソルキーで選択し、Enter キーで決定する。
- `fzf`のようなインクリメンタルなファジーサーチ機能を提供する。

### 2.4. 設定ファイル

- **パス:** `~/.config/wtm/config.toml` または `~/.wtmrc`
- **設定項目:**
  - `worktree_base_path`: worktree を作成するベースディレクトリ (例: `"/Users/myuser/dev/worktrees"`)
  - `main_branches`: メインラインとなるブランチ名のリスト (例: `["main", "master", "develop"]`)。`clean`コマンドや`create`コマンドのデフォルト分岐元として使用する。

## 3\. コマンド仕様 (Command Specifications)

---

### 3.1. `wtm list` (エイリアス: `ls`)

- **目的:** 現在のプロジェクトに存在する worktree の一覧を、詳細情報と共に分かりやすく表示する。
- **構文:** `wtm list`
- **実行フロー:**
  1.  `git worktree list --porcelain` を実行して、マシンリーダブルな形式で worktree 情報を取得する。
  2.  各 worktree について、ブランチがリモートの`main_branches`にマージ済みか判定する。
  3.  判定結果やその他の情報を加えて、整形されたテーブル形式で標準出力に表示する。
- **出力形式（例）:**
  ```
  STATUS      BRANCH                   PATH                                  HEAD
  ----------- ------------------------ ------------------------------------- --------
  * ACTIVE    feature/new-ui           /path/to/project                      a1b2c3d Add new button
    PRUNABLE  fix/login-bug (merged)   ~/worktrees/project/fix-login-bug     e4f5g6h Fix typo
    NORMAL    feature/api-cache        ~/worktrees/project/feature-api-cache c7d8e9f Implement caching
  ```
  - **STATUS:**
    - `ACTIVE`: 現在のディレクトリが属する worktree。`*` を付ける。
    - `NORMAL`: 通常の worktree。
    - `PRUNABLE`: `main_branches`にマージ済み、またはリモートでブランチが削除されている。`wtm clean`の削除対象候補。
    - `LOCKED`: `git worktree lock` されている worktree。

---

### 3.2. `wtm create [branch_name]`

- **目的:** 指定されたブランチから新しい worktree を作成する。
- **構文:** `wtm create [branch_name] [-r | --remote] [--from <base_branch>]`
- **引数:**
  - `branch_name` (任意): 作成する worktree のブランチ名。省略した場合、対話的にリモートブランチを選択する UI を起動する。
- **オプション:**
  - `-r, --remote`: `branch_name`をリモートブランチ (`origin/branch_name`) として扱う。
  - `--from <base_branch>`: `branch_name`を新規作成する際の分岐元ブランチを指定する。**\<ins\>デフォルトは設定ファイル `main_branches` の最初のブランチ (例: `main`)\</ins\>。**
- **実行フロー:**
  1.  **`branch_name`が指定されている場合:**
      - **ローカル/新規ブランチの場合（`-r`なし）:**
        - ローカルに`branch_name`が存在すれば、そのブランチで worktree を作成する。
        - 存在しなければ、`--from`で指定されたブランチから`branch_name`を新規作成し、そのブランチで worktree を作成する。
      - **リモートブランチの場合（`-r`あり）:**
        - `git fetch origin`を実行する。
        - リモートブランチ`origin/<branch_name>`を追跡するローカルブランチ`branch_name`を作成する。
        - ローカルブランチ`branch_name`で worktree を作成する。
  2.  **`branch_name`が省略された場合:**
      - リモートブランチの一覧を取得し、対話的 UI を表示する。
      - ユーザーが選択したリモートブランチで、上記のフロー（リモートブランチの場合）を実行する。
  3.  成功した場合、作成された worktree のフルパスを標準出力に出力する。

---

### 3.3. `wtm remove` (エイリアス: `rm`)

- **目的:** 一つまたは複数の worktree を削除する。
- **構文:** `wtm remove [query]`
- **引数:**
  - `query` (任意): 削除したい worktree のブランチ名を指定する。ファジーサーチの初期クエリとして使用される。
- **オプション:**
  - `--force, -f`: 未コミットの変更があっても強制的に削除する。
- **実行フロー:**
  1.  現在のプロジェクトの worktree 一覧を取得する（メインの worktree は除く）。
  2.  対話的 UI を起動する。`query`引数があれば、それで初期フィルタリングする。
  3.  ユーザーが削除対象の worktree を（複数選択可能にして）選択する。
  4.  選択された各 worktree に対して `git worktree remove` を実行する。`--force` オプションが指定されていれば、コマンドにも付与する。

---

### 3.4. `wtm clean`

- **目的:** リモートでマージ済み、または削除済みの古い worktree を掃除する。
- **構文:** `wtm clean`
- **オプション:**
  - `--yes, -y`: **\<ins\>対話的な選択モードをスキップし、\</ins\>** 検出された削除可能な worktree をすべて即座に削除する。
- **実行フロー:**
  1.  `git fetch --prune origin` を実行し、リモートの状態を最新化する。
  2.  設定ファイルで指定された `main_branches` を取得する。
  3.  以下の条件に合致する「削除可能 (`PRUNABLE`)」な worktree をリストアップする。
      - 対応するブランチが `main_branches` のいずれかにマージ済みである。
      - 対応するリモート追跡ブランチが存在しない。
  4.  **\<ins\>もし`--yes`オプションが指定されていなければ、以下の対話モードに入る。\</ins\>**
      - \<ins\>削除候補の worktree 一覧で対話的な UI を起動する。\</ins\>
      - \<ins\>ユーザーは削除したい worktree を（複数）選択できる。\</ins\>
      - \<ins\>ユーザーが承認した場合、**選択された worktree のみ**を削除する。\</ins\>
  5.  **\<ins\>`--yes`オプションが指定されている場合、** 削除候補の worktree をすべて削除する。\</ins\>

---

### 3.5. `wtm go`

- **目的:** シェルと連携し、選択した worktree のディレクトリに移動 (`cd`) するためのパスを出力する。
- **構文:** `wtm go [query]`
- **引数:**
  - `query` (任意): 移動したい worktree のブランチ名を指定する。ファジーサーチの初期クエリとして使用される。
- **実行フロー:**
  1.  対話的 UI を起動して、ユーザーに移動先の worktree を選択させる。
  2.  ユーザーが worktree を選択して決定した場合、その worktree の**フルパスのみ**を標準出力に出力する。
  3.  ユーザーがキャンセルした場合（ESC キーなど）、何も出力せずに終了する。
- **シェルの設定例（ドキュメントに記載）:**
  ```shell
  # ~/.zshrc or ~/.bashrc
  function wgo() {
    local path
    path="$(wtm go "$1")"
    if [ -n "$path" ]; then
      cd "$path"
    fi
  }
  ```

---

### 3.6. `wtm code`

- **目的:** 選択した worktree を Visual Studio Code で開く。
- **構文:** `wtm code [query]`
- **引数:**
  - `query` (任意): 開きたい worktree のブランチ名を指定する。ファジーサーチの初期クエリとして使用される。
- **実行フロー:**
  1.  `wtm go` と同様に、対話的 UI でユーザーに worktree を選択させる。
  2.  ユーザーが worktree を選択して決定した場合、`code <selected_path>` コマンドを実行して VSCode でそのディレクトリを開く。
  3.  `code` コマンドが PATH 上に存在しない場合は、エラーメッセージを表示する。

---

## 4\. 技術スタック (Technology Stack)

本 CLI ツールは、モダンで堅牢な開発体験と、リッチな UI を提供するために以下の技術を採用する。

- **言語: TypeScript**

  - 静的型付けによるコンパイル時のエラー検出と、エディタの強力な補完サポートにより、開発効率とコードの品質を向上させる。

- **フレームワーク: React**

  - 宣言的な UI 記述により、複雑な状態を持つインタラクティブなインターフェースの構築を容易にする。コンポーネントベースの設計は、コードの再利用性とメンテナンス性を高める。

- **CLI ライブラリ: Ink**

  - React コンポーネントを用いて CLI の UI を構築するためのライブラリ。これにより、ターミナル上でもリッチでインタラクティブなユーザー体験（例: `fzf`ライクなリスト選択）を提供できる。
  - https://github.com/vadimdemedes/ink
