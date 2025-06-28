# CLI ツール `gwm` 開発仕様書

## 1\. 概要 (Overview)

### 1.1. ツール名

`gwm` (worktree manager の略)

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

基本的なコマンド体系は `gwm <command> [arguments] [options]` とする。

### 2.2. Worktree の作成場所

- **デフォルトパス:** 新しい worktree は `~/git-worktrees/<repository-name>/<branch-name>` に作成される。
  - `<repository-name>` は Git リポジトリのディレクトリ名。
  - `<branch-name>` は `feature/user-auth` のようなスラッシュを含むブランチの場合、`feature-user-auth` のようにハイフンに変換される。
- **設定によるカスタマイズ:** ユーザーは設定ファイルでベースパス (`~/git-worktrees`) を変更できる。

### 2.3. 対話的インターフェース (Interactive UI)

- 各コマンドで worktree の選択が必要な場合（例: `gwm go`, `gwm rm`）、引数がなければ対話的 UI を起動する。
- UI には worktree の一覧が整形されて表示され、ユーザーはカーソルキーで選択し、Enter キーで決定する。
- `fzf`のようなインクリメンタルなファジーサーチ機能を提供する。

### 2.4. 設定ファイル

- **パス:** `~/.config/gwm/config.toml` または `~/.gwmrc`
- **設定項目:**
  - `worktree_base_path`: worktree を作成するベースディレクトリ (例: `"/Users/myuser/dev/git-worktrees"`)
  - `main_branches`: メインラインとなるブランチ名のリスト (例: `["main", "master", "develop"]`)。`clean`コマンドや`add`コマンドのデフォルト分岐元として使用する。

## 3\. コマンド仕様 (Command Specifications)

---

### 3.1. `gwm list` (エイリアス: `ls`)

- **目的:** 現在のプロジェクトに存在する worktree の一覧を、詳細情報と共に分かりやすく表示する。
- **構文:** `gwm list`
- **実行フロー:**
  1.  `git worktree list --porcelain` を実行して、マシンリーダブルな形式で worktree 情報を取得する。
  2.  各 worktree について、3分類のステータス（ACTIVE/MAIN/OTHER）を判定する。
  3.  判定結果やその他の情報を加えて、整形されたテーブル形式で標準出力に表示する。
- **出力形式（例）:**
  ```
  STATUS      BRANCH                   PATH                                  HEAD
  ----------- ------------------------ ------------------------------------- --------
  * ACTIVE    feature/new-ui           /path/to/project                      a1b2c3d Add new button
  M MAIN      main                     ~/git-worktrees/project/main             123abc4 Latest main
  - OTHER     feature/api-cache        ~/git-worktrees/project/feature-api-cache c7d8e9f Implement caching
  ```
  - **STATUS:**
    - `ACTIVE`: 現在のディレクトリが属する worktree。`*` を付ける（yellow）。
    - `MAIN`: ベースとなるメインの worktree。`M` を付ける（cyan）。
    - `OTHER`: その他の worktree。`-` を付ける（white）。

---

### 3.2. `gwm add [branch_name]`

- **目的:** 新しいworktreeを作成する。主に以下の2つのユースケースをサポートする：
  1. **新規ブランチ作成** - デフォルトブランチから分岐した新しいブランチでworktreeを作成（並行開発用）
  2. **リモートブランチ取得** - リモートブランチからworktreeを作成（PRレビュー用）

- **構文:** `gwm add [branch_name] [-r | --remote] [--from <base_branch>]`

- **引数:**
  - `branch_name` (任意): 作成するworktreeのブランチ名。省略した場合、対話的UIを起動する。

- **オプション:**
  - `-r, --remote`: リモートブランチからworktreeを作成するモードに切り替える
  - `--from <base_branch>`: 新規ブランチ作成時の分岐元ブランチを指定（デフォルト: `main_branches`の最初のブランチ）

- **対話的UI（引数なしの場合）:**
  - **デフォルトモード: 新規ブランチ入力**
    - ブランチ名の入力フィールドが表示される
    - リアルタイムでブランチ名の妥当性検証を行う
    - 作成予定のworktreeパスをプレビュー表示
    - Git のブランチ名制約に従った入力制限：
      - 無効文字（`~^:?*[]\`）の禁止
      - ピリオド（`.`）で開始・終了の禁止
      - 連続ピリオド（`..`）の禁止
      - スペースの禁止
      - 最大50文字制限

  - **キーボード操作:**
    - `Enter`: ブランチ作成・worktree作成を実行（妥当な入力時のみ）
    - `Tab`: リモートブランチ選択モードに切り替え
    - `Esc`: キャンセル
    - `Ctrl+U`: 入力内容をクリア

  - **リモートブランチ選択モード:**
    - `Tab`キーまたは`-r`オプションで起動
    - リモートブランチ一覧をファジーサーチで選択
    - 自動で`git fetch origin`を実行してリモート情報を更新
    - ブランチ統計情報とプレビューを表示

- **実行フロー:**
  1. **ブランチ名が指定されている場合:**
     - **新規/ローカルブランチモード（`-r`なし）:**
       - ローカルブランチ`branch_name`の存在確認（`git show-ref --verify`）
       - 存在する場合: 既存ブランチでworktreeを作成
       - 存在しない場合: `--from`指定ブランチ（デフォルト: メインブランチ）から新規作成
     - **リモートブランチモード（`-r`あり）:**
       - `git fetch origin`でリモート情報を更新
       - `origin/branch_name`からローカル追跡ブランチを作成

  2. **ブランチ名が省略された場合:**
     - **デフォルト: 新規ブランチ入力モード**
       - TextInputコンポーネントでブランチ名入力
       - リアルタイム妥当性検証とプレビュー
     - **`-r`指定時: リモートブランチ選択モード**
       - リモートブランチ一覧取得後、SelectListコンポーネント表示

  3. **worktree作成:**
     - 作成場所: `{worktree_base_path}/{repo_name}/{sanitized_branch_name}`
     - ブランチ名正規化: スラッシュ（`/`）をハイフン（`-`）に変換
     - 成功時: 作成されたworktreeのフルパスを表示
     - エラー時: 詳細なエラーメッセージを表示

- **作成されるGitコマンド例:**

  ```bash
  # 新規ブランチ作成
  git worktree add "/path/to/git-worktrees/repo/feature-auth" -b "feature/auth" "main"

  # 既存ローカルブランチ
  git worktree add "/path/to/git-worktrees/repo/existing-branch" "existing-branch"

  # リモートブランチから作成
  git worktree add "/path/to/git-worktrees/repo/feature-api" -b "feature/api" "origin/feature/api"
  ```

- **UX設計原則:**
  - 新規ブランチ作成を主要ユースケースとして優先
  - 最小限のキーストロークで操作完了
  - リアルタイムフィードバックによる入力ミスの防止
  - モード切り替えによる柔軟な操作フロー

---

### 3.3. `gwm remove` (エイリアス: `rm`)

- **目的:** 一つまたは複数の worktree を削除する。
- **構文:** `gwm remove [query]`
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

### 3.4. `gwm go`

- **目的:** シェルと連携し、選択した worktree のディレクトリに移動 (`cd`) するためのパスを出力する。
- **構文:** `gwm go [query]`
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
    path="$(gwm go "$1")"
    if [ -n "$path" ]; then
      cd "$path"
    fi
  }
  ```

---

### 3.5. `gwm code`

- **目的:** 選択した worktree を Visual Studio Code で開く。
- **構文:** `gwm code [query]`
- **引数:**
  - `query` (任意): 開きたい worktree のブランチ名を指定する。ファジーサーチの初期クエリとして使用される。
- **実行フロー:**
  1.  `gwm go` と同様に、対話的 UI でユーザーに worktree を選択させる。
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
