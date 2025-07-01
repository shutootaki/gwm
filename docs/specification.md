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
  - `clean_branch`: worktree 削除後にローカルブランチを自動整理するモード。`"auto"`, `"ask"`, `"never"` から選択 (デフォルト: `"ask"`)。
  - `copy_ignored_files`: gitignoreされたファイルのコピー設定
    - `enabled`: 機能の有効/無効 (デフォルト: `true`)
    - `patterns`: コピー対象のファイルパターン (デフォルト: `[".env", ".env.*", ".env.local", ".env.*.local"]`)
    - `exclude_patterns`: 除外パターン (デフォルト: `[".env.example", ".env.sample"]`)

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
  * ACTIVE    feature/new-ui           /path/to/project                      a1b2c3d
  M MAIN      main                     ~/git-worktrees/project/main             123abc4
  - OTHER     feature/api-cache        ~/git-worktrees/project/feature-api-cache c7d8e9f
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

- **構文:** `gwm add [branch_name] [-r | --remote] [--from <base_branch>] [--code] [--cursor] [--cd]`

- **引数:**
  - `branch_name` (任意): 作成するworktreeのブランチ名。省略した場合、対話的UIを起動する。

- **オプション:**
  - `-r, --remote`: リモートブランチからworktreeを作成するモードに切り替える
  - `--from <base_branch>`: 新規ブランチ作成時の分岐元ブランチを指定（デフォルト: `main_branches`の最初のブランチ）
  - `--code`: 作成後に VS Code を起動して worktree を開く
  - `--cursor`: 作成後に Cursor を起動して worktree を開く
  - `--cd`: worktree パスのみを標準出力して終了（シェル連携用）

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

  4. **gitignoreされたファイルのコピー (copy_ignored_files が有効な場合):**
     - メインワークツリーから新規ワークツリーへ、gitignoreされたファイルを自動コピー
     - 設定の `patterns` に一致し、`exclude_patterns` に一致しないファイルが対象
     - ディレクトリ構造を保持してコピー
     - コピー成功時: コピーしたファイル数とファイル名をアクションに追加
     - エラー時: 個別のエラーメッセージを表示（ワークツリー作成自体は成功扱い）

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
  - `--clean-branch <mode>`: worktree 削除後にローカルブランチも整理するかを指定する。`mode` は `auto` / `ask` / `never`。  
    （`ask` モードは現行バージョンでは候補を通知するのみで対話プロンプトは表示されません）
- **実行フロー:**
  1.  現在のプロジェクトの worktree 一覧を取得する（メインの worktree は除く）。
  2.  対話的 UI を起動する。`query`引数があれば、それで初期フィルタリングする。
  3.  ユーザーが削除対象の worktree を（複数選択可能にして）選択する。
  4.  選択された各 worktree に対して `git worktree remove` を実行する。`--force` オプションが指定されていれば、コマンドにも付与する。
  5.  `--clean-branch` または設定 `clean_branch` が `auto` の場合、削除した worktree と同名のローカルブランチをスキャンし、他の worktree で未使用かつ未マージコミットが無い場合に自動削除する（未マージがある場合は `git branch -D` を使用）。`ask` の場合は候補を通知のみ行う。

---

### 3.4. `gwm go`

- **目的:** 選択した worktree へ **直接移動**（サブシェル起動）する、またはエディタで開く。
- **構文:** `gwm go [query] [--code|-c] [--cursor]`
- **引数:**
  - `query` (任意): 移動・オープンしたい worktree のブランチ名を指定。ファジーサーチの初期クエリとして使用。
- **オプション:**
  - `--code`, `-c`: 選択した worktree を VS Code で開く。
  - `--cursor`: 選択した worktree を Cursor で開く。
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

### 3.5. `gwm clean`

- **目的:** 安全にworktreeを削除する。削除対象は以下の条件を**すべて**満たすworktreeのみ：
  1. **リモートブランチが削除されている** または **メインブランチにマージされている**
  2. **ローカルでの変更がない**（未ステージング、未追跡、ステージング済み、ローカル限定コミットがすべて存在しない）
  3. **MAIN/ACTIVEステータスではない**

- **構文:** `gwm clean [-n | --dry-run] [--force]`

- **オプション:**
  - `-n, --dry-run`: 一覧を表示するだけで削除は実行しない
  - `--force`: 確認プロンプトをスキップし即時削除（CI などで使用）

- **実行フロー:**
  1. **リモート情報の更新**
     - `git fetch --prune origin` を実行してリモートブランチの最新状態を取得
  2. **削除可能なworktreeの特定**
     - 各worktreeについて以下をチェック：
       - **リモートブランチステータス**: `git ls-remote` でリモートブランチの存在確認
       - **マージ状態**: `git merge-base --is-ancestor` でメインブランチへのマージ状態確認
       - **ローカル変更**: `git status --porcelain` で未コミット変更確認
       - **ローカル限定コミット**: `git log` でリモートにプッシュされていないコミット確認
     - MAIN/ACTIVEステータスのworktreeは除外

  3. **ユーザー操作**
     - 候補が 0 件の場合: 「クリーンアップ不要」メッセージを表示
     - 候補が 1 件以上の場合: 一覧を表示し、以下のキー操作を受け付ける
       - **Enter** … 候補をすべて削除
       - **Esc / Ctrl-C** … キャンセル

  4. **削除実行**
     - 通常モード: Enter 押下後に確認プロンプトを経て削除を実行
     - `--force` 指定時: 確認をスキップして即時削除
     - 各 worktree に対して `git worktree remove --force` を実行
     - 成功 / 失敗の詳細結果を表示

- **安全性の確保:**
  - **二重チェック**: リモート状態とローカル変更の両方を確認
  - **除外対象**: MAIN/ACTIVEワークツリーは対象外
  - **詳細表示**: 削除理由を明確に表示（「Remote branch deleted」「Merged into main」など）
  - **確認フロー**: `--force` 以外では Enter 前に確認を実施

- **削除条件の詳細:**

  **削除対象となる条件:**

  ```
  (リモートブランチが削除されている OR メインブランチにマージされている)
  AND
  (ローカル変更がない)
  AND
  (MAIN/ACTIVEステータスではない)
  ```

  **削除対象外となる条件:**
  - 未ステージングの変更がある
  - 未追跡ファイルがある
  - ステージング済みの変更がある
  - リモートにプッシュされていないローカルコミットがある
  - MAINまたはACTIVEステータスのworktree

- **出力例:**

  ```
  🔍 Found 2 cleanable worktree(s):

  📁 feature/user-auth        ~/worktrees/project/feature-user-auth
   → Merged into main

  📁 hotfix/critical-bug      ~/worktrees/project/hotfix-critical-bug
   → Remote branch deleted

  ✓ Successfully cleaned 2 worktree(s):
  ~/worktrees/project/feature-user-auth
  ~/worktrees/project/hotfix-critical-bug
  ```

- **エラーハンドリング:**
  - Git操作エラー: 詳細なエラーメッセージを表示
  - 削除失敗: 失敗したworktreeと理由を個別に表示
  - ネットワークエラー: フェッチ失敗時の適切なメッセージ

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

### 補足: `gwm pull-main`

`gwm pull-main` はプロジェクトの Git リポジトリ（いずれかの worktree）内で実行する必要があります。リポジトリ外の任意ディレクトリからの実行はサポートしていません。

---

### 3.7. gitignoreされたファイルのコピー機能

#### 3.7.1. 概要

`gwm add` コマンドで新しいワークツリーを作成する際に、gitignoreされたファイル（.envファイルなど）をメインワークツリーから新規ワークツリーにコピーする機能。Git worktreeは、gitで管理されているファイルのみを新しいワークツリーに含めるため、.gitignoreされたファイル（環境変数ファイルなど）は含まれない。これらのファイルは開発環境の設定に必要な場合が多く、手動でコピーする手間を省く。

#### 3.7.2. 設定

`~/.config/gwm/config.toml` で以下の設定が可能：

```toml
[copy_ignored_files]
enabled = true  # 機能の有効/無効
patterns = [".env", ".env.*", ".env.local", ".env.*.local"]  # コピー対象のファイルパターン
exclude_patterns = [".env.example", ".env.sample"]  # 除外パターン
```

#### 3.7.3. 動作仕様

1. **ファイル検出:**
   - メインワークツリー内で `patterns` に一致するファイルを再帰的に検索
   - `exclude_patterns` に一致するファイルは除外
   - Git で追跡されていないファイルのみが対象（`git ls-files --error-unmatch` で確認）
   - `.git` ディレクトリは検索対象外

2. **ファイルコピー:**
   - ディレクトリ構造を保持してコピー
   - 存在しないディレクトリは自動作成
   - ファイルのパーミッションは保持されない（Node.js の fs.copyFileSync の仕様）
   - シンボリックリンクは実ファイルとしてコピー

3. **エラーハンドリング:**
   - メインワークツリーが見つからない場合：コピー処理をスキップ
   - ソースとターゲットが同じパスの場合：コピー処理をスキップ
   - 個別のファイルコピーに失敗した場合：そのファイルをスキップして続行
   - コピーエラーが発生してもワークツリー作成自体は成功扱い

4. **ユーザーフィードバック:**
   - コピーされたファイルがある場合：`Copied N ignored file(s): file1, file2, ...` をアクションに追加
   - コピーされたファイルがない場合：アクションに何も追加しない

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
  --code                   Open the created worktree in VS Code
  --cursor                 Open the created worktree in Cursor
  --cd                     Output the worktree path only and exit (for shell integration)

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
