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

- **目的:** 選択した worktree へ **直接移動**（サブシェル起動）する、またはエディタで開く。
- **構文:** `gwm go [query] [--code] [--cursor]`
- **引数:**
  - `query` (任意): 移動・オープンしたい worktree のブランチ名を指定。ファジーサーチの初期クエリとして使用。
- **オプション:**
  - `--code`: 選択した worktree を VS Code で開き、`gwm` は即終了する。
  - `--cursor`: 選択した worktree を Cursor で開き、`gwm` は即終了する。
- **デフォルト挙動 (オプション無し):**
  1. 対話的 UI で worktree を選択。
  2. 選択後、ユーザーのログインシェル (`$SHELL`) をサブプロセスとして起動し、`cwd` を選択した worktree パスに設定する。
  3. ユーザーがサブシェルを抜けると (`exit` など)、`gwm` も終了する。
- **フローチャート:**
  ```text
  start -> UI -> [Select] -> { --code? } yes -> open VSCode -> exit
                                     no  -> { --cursor? } yes -> open Cursor -> exit
                                     no  -> spawn subshell (cd) -> wait -> exit
  ```

> **補足:** 旧バージョンで必要だった `wgo()` シェル関数は不要となった。

---

### 3.6. `gwm pull-main`

- **目的:** カレントディレクトリがworktreeディレクトリ以外の場所にある場合でも、メインブランチのworktreeを最新の状態に更新する。
- **構文:** `gwm pull-main`
- **背景:** 
  - ユーザーのworktreeファイルが特定のディレクトリ（例: `~/username/git-worktree`）にあり、ベースのworktreeに直接移動できない場合がある
  - このコマンドにより、任意のディレクトリからメインブランチの更新が可能になる
- **実行フロー:**
  1. 設定ファイルから `main_branches` の設定を読み込む（例: `["main", "master", "develop"]`）
  2. 現在のプロジェクトのworktree一覧を取得し、メインブランチに該当するworktreeを特定
  3. 各メインブランチのworktreeで `git pull` を実行
  4. 各worktreeの更新結果（成功/失敗）を表示
- **出力例:**
  ```
  ✅ メインブランチの更新が完了しました
  
  ✅ refs/heads/main (/Users/user/worktrees/project/main)
     Updating a1b2c3d..e4f5g6h
     Fast-forward
      src/utils/git.ts | 10 ++++++++++
      1 file changed, 10 insertions(+)
  ```
- **エラーハンドリング:**
  - メインブランチのworktreeが見つからない場合: 該当ブランチ名を含むエラーメッセージを表示
  - 個別のpull処理でエラーが発生した場合: そのworktreeのみ失敗として記録し、他の処理は継続
  - Git操作エラー: 詳細なエラーメッセージを表示

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

---

## 5. ヘルプシステム (Help System)

### 5.1. `gwm help [command]`

#### 5.1.1. 目的

`gwm` の使い方や、各サブコマンドの詳細な機能、引数、オプションをユーザーに分かりやすく提示します。ユーザーがコマンドを忘れたり、使い方に迷ったりした際に、ターミナルを離れることなく迅速に自己解決できる環境を提供し、学習コストを低減させることを目的とします。

#### 5.1.2. 構文

`help`機能は、以下の標準的なCLIパターンで呼び出せるものとします。

  - **グローバルヘルプ:**

      - `gwm help`
      - `gwm --help`
      - `gwm -h`

  - **コマンド固有ヘルプ:**

      - `gwm help <command>` (例: `gwm help add`)
      - `gwm <command> --help` (例: `gwm add --help`)
      - `gwm <command> -h` (例: `gwm add -h`)

#### 5.1.3. 動作仕様

`help`コマンドは、呼び出され方によって表示する情報の粒度を変え、ユーザーが必要とする情報へ最短でアクセスできるよう設計します。

**A) グローバルヘルプ (`gwm help`)**

引数なしで実行された場合、ツール全体の概要と利用可能なコマンドの一覧を表示します。

  - **表示内容:**
    1.  **概要 (Overview):** ツールが解決する課題を一文で簡潔に説明します。
          - 例: `gwm: A CLI tool to streamline your git worktree workflow.`
    2.  **使い方 (Usage):** 基本的なコマンドの構造を示します。
          - 例: `gwm <command> [arguments] [options]`
    3.  **利用可能なコマンド (Available Commands):**
          - 各コマンド名（とエイリアス）および、その目的を一行で説明するリストを表示します。
          - `list`, `add`, `remove`, `go`, `pull-main`, そして `help` 自体も含めます。
    4.  **詳細情報への誘導:**
          - 特定のコマンドについて詳しく知りたい場合の使い方 (`gwm help <command>`) を案内します。

**B) コマンド固有ヘルプ (`gwm help <command>`)**

特定のコマンド名と共に実行された場合、そのコマンドに特化した詳細な情報を表示します。

  - **表示内容 (`gwm help add` の例):**
    1.  **コマンドの目的:** そのコマンドが何をするためのものかを、より具体的に説明します。
          - 例: `Create a new worktree from a new, existing, or remote branch.`
    2.  **使い方 (Usage):** コマンドの代表的な使い方を構文として示します。
          - 例: `gwm add [branch_name] [options]`
    3.  **引数 (Arguments):**
          - 各引数の意味、必須か任意か、省略した場合のデフォルトの挙動（例: 対話的UIの起動）を説明します。
    4.  **オプション (Options):**
          - 利用可能な全オプション（例: `-r, --remote`）とその機能を説明します。
    5.  **使用例 (Examples):**
          - **ユーザー体験の核となる部分です。** 実際のユースケースに基づいた、コピー＆ペーストしてすぐに使える具体的なコマンド例を複数提示します。これにより、ユーザーはドキュメントを読むだけでなく、実際の使い方を直感的に理解できます。

#### 5.1.4. UX設計原則

  - **発見可能性 (Discoverability):** `gwm help` だけで、このツールで何ができるのか全体像を掴めるようにします。これにより、ユーザーは機能を「発見」しやすくなります。
  - **段階的開示 (Progressive Disclosure):** 最初は概要（グローバルヘルプ）、必要に応じて詳細（コマンド固有ヘルプ）へとドリルダウンできる構造にします。情報過多でユーザーを圧倒することを防ぎます。
  - **文脈依存性 (Context-Aware):** ユーザーが `add` コマンドについて知りたい時は、`add` に関連する情報だけを的確に提供します。
  - **一貫性 (Consistency):** `--help`, `-h` といった、多くのユーザーが慣れ親しんだ業界標準の作法に準拠することで、学習コストを最小限に抑えます。
  - **実践的な例 (Actionable Examples):** 「読む」ヘルプから「試す」ヘルプへ。具体的な使用例は、ユーザーが機能を試すハードルを下げ、ツールの活用を促進します。

#### 5.1.5. 出力フォーマット例

ヘルプの出力は、情報を素早く探せるよう、セクション分けと整形を施します。

**`$ gwm help` の出力例:**

```
gwm: A CLI tool to streamline your git worktree workflow.

USAGE:
  gwm <command> [arguments] [options]

AVAILABLE COMMANDS:
  add      Create a new worktree
  go       Go to a worktree directory or open it in an editor
  list     (ls) List all worktrees for the current project
  pull-main Update the main branch worktree
  remove   (rm) Remove one or more worktrees
  help     Show help for gwm or a specific command

Use "gwm help <command>" for more information about a specific command.
```

**`$ gwm help add` の出力例:**

```
Create a new worktree from a new, existing, or remote branch.
If no branch name is provided, an interactive UI will be launched.

USAGE:
  gwm add [branch_name] [options]

ARGUMENTS:
  branch_name    Name of the branch for the new worktree. (optional)

OPTIONS:
  -r, --remote             Fetch from remote and create a worktree from a remote branch
  --from <base_branch>     Specify the base branch to branch off from.
                           Defaults to the first branch in 'main_branches' config (e.g., "main").

EXAMPLES:
  # Interactively create a new branch and worktree
  $ gwm add

  # Create a worktree for a new branch 'feature/user-profile' from the main branch
  $ gwm add feature/user-profile

  # Create a worktree from a remote branch for a pull request review
  $ gwm add a-pull-request-branch -r

  # Create a new branch from 'develop' instead of the default main branch
  $ gwm add hotfix/urgent-patch --from develop
```
