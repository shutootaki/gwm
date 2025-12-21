## 1. 目的

### 1.1 追加する機能

1. `gwm add` による **worktree 作成が成功した直後**に、ユーザーが設定した **複数コマンドを逐次実行**できるようにする（hook 名は `post_create`）。
2. リポジトリ直下に **`gwm/config.toml`** が存在する場合は、ユーザーのグローバル設定である **`~/.config/gwm/config.toml`**（および既存の `~/.gwmrc`）よりも **プロジェクト側設定を優先**する。

   * 既存の README は、設定ファイルとして `~/.config/gwm/config.toml` または `~/.gwmrc` を示しているため、この優先順位追加は既存仕様を拡張する形になる。 ([GitHub][1])

### 1.2 既存機能との整合性（README から読み取れる範囲）

* gwm は `~/.config/gwm/config.toml`（または `~/.gwmrc`）で `worktree_base_path` などを設定できる。 ([GitHub][1])
* `copy_ignored_files` を有効化すると、`.env` などの Git 管理外ファイルを main worktree から新規 worktree へコピーする既存機能がある。 ([GitHub][1])
  → `post_create` は、このコピー完了後に走るのが自然（後述）。

---

## 2. スコープ

### 2.1 今回のスコープ（やる）

* `post_create` のみ
* コマンド実行は **逐次実行のみ**
* 設定ファイルの優先順位（プロジェクト > グローバル）対応
* `gwm add` のみをトリガーにする（worktree 作成の代表コマンドであり、README 上も作成操作の中心であるため） ([GitHub][1])

### 2.2 今回のスコープ外（やらない）

* `pre_remove` / `post_remove`
* 並列実行
* `gwm clean` や `gwm pull-main` など、他コマンドでの hook 発火（将来拡張の余地として残す）

---

## 3. 用語定義

* **プロジェクト設定ファイル**: `<git-repo-root>/gwm/config.toml`
* **グローバル設定ファイル**: `~/.config/gwm/config.toml` または `~/.gwmrc`（既存仕様） ([GitHub][1])
* **post_create hook**: worktree 作成直後に走る処理（今回の実装対象）

---

## 4. 設定仕様

### 4.1 設定ファイル探索と優先順位

#### 4.1.1 探索順（優先順位が高い順）

1. `<git-repo-root>/gwm/config.toml`（プロジェクト設定）
2. `~/.config/gwm/config.toml`（グローバル設定）
3. `~/.gwmrc`（グローバル設定・互換）

#### 4.1.2 マージ規則（推奨：深いマージ）

要件文言は「プロジェクトの設定を優先」となっているため、実務上の利便性を考えると **マージが最適**です。

* アプリケーションは、まずグローバル設定を読み込み、次にプロジェクト設定を読み込む。
* アプリケーションは、最終的な `effective config` を **深いマージ**で生成する。

  * スカラー値（文字列/数値/真偽値）は **プロジェクト設定が上書き**する。
  * ネストしたテーブル（例: `[copy_ignored_files]`）は **再帰的にマージ**する。
  * 配列（例: `patterns` / `commands`）は **プロジェクト設定側で全置換**する（結合はしない）。

この規則により、ユーザーは「グローバルで worktree の基準ディレクトリだけ決める」「プロジェクトごとに hook だけ切り替える」が可能になる。

> もし既存実装が「単一ファイルのみロード」しかしていない場合でも、今回の仕様ではマージ方式を推奨とします（実装コストが比較的低く、UX が良い）。

---

### 4.2 `post_create` 設定スキーマ（TOML）

設定ファイルに次のセクションを追加する。

```toml
[hooks.post_create]
enabled = true
commands = [
  "pnpm install",
  "pnpm test"
]
```

#### 4.2.1 フィールド定義

* `[hooks.post_create]`（テーブル）

  * `enabled`（任意, boolean）

    * 省略時は `true` とする
  * `commands`（任意, string 配列）

    * 省略または空配列の場合、`post_create` は何もしない
    * 各要素は「シェルに渡す 1 コマンド文字列」として扱う

> 将来、コマンドごとの `cwd` や `env` を扱いたくなった場合は、`[[hooks.post_create.commands]]` の「配列 of テーブル」に移行できるが、今回はスコープ外とする。

---

## 5. 実行仕様（`gwm add` における挙動）

### 5.1 hook の発火タイミング

アプリケーションは `gwm add` による worktree 作成フローにおいて、次の順序で処理する。

1. アプリケーションは worktree を作成する。
2. （既存機能が有効なら）アプリケーションは `copy_ignored_files` により Git 管理外ファイルをコピーする。 ([GitHub][1])
3. アプリケーションは `post_create` hook を実行する（今回追加）。
4. アプリケーションは（既存挙動があるなら）エディタ起動（`--code` / `--cursor`）やディレクトリ移動相当の処理に進む。 ([GitHub][1])

この順序により、`post_create` で `pnpm install` などを行うユースケースで、`.env` が揃った状態でコマンドを実行できる。

#### 5.1.1 `--skip-hooks` フラグ

`gwm add --skip-hooks` を指定した場合、アプリケーションは `post_create` hook を実行しない。

* デバッグ時やテスト時など、hook をスキップしたいケースで有用
* `enabled = false` と同等の効果だが、コマンドライン引数で一時的にスキップ可能

---

### 5.2 コマンドの実行方法（逐次）

* アプリケーションは `commands` を先頭から順に 1 つずつ実行する。
* アプリケーションは、前のコマンドが **終了した後**に次のコマンドを実行する。
* アプリケーションは、いずれかのコマンドが失敗した場合、以降のコマンドを実行しない。

---

### 5.3 実行コンテキスト（cwd / 環境変数 / 標準入出力）

* アプリケーションは、各コマンドを **新規 worktree ディレクトリをカレントディレクトリ**として実行する（`cwd = worktreePath`）。
* アプリケーションは、各コマンドへ **親プロセスの環境変数**を引き継ぐ（`process.env`）。
* アプリケーションは、各コマンドの標準出力・標準エラー出力を **そのまま端末へ流す**（ユーザーが失敗原因を読めることを優先）。

#### 5.3.1 hook 用環境変数

アプリケーションは、hook コマンド実行時に以下の環境変数を追加で提供する。

| 環境変数 | 説明 | 例 |
|----------|------|-----|
| `GWM_WORKTREE_PATH` | 新規 worktree の絶対パス | `/Users/test/git-worktrees/my-project/feature-auth` |
| `GWM_BRANCH_NAME` | ブランチ名 | `feature-auth` |
| `GWM_REPO_ROOT` | 元リポジトリのルートパス（main worktree） | `/Users/test/projects/my-project` |
| `GWM_REPO_NAME` | リポジトリ名 | `my-project` |

これにより、hook スクリプト内で worktree やリポジトリの情報を参照できる。

```bash
# 例: hook コマンド内での使用
echo "Created worktree at $GWM_WORKTREE_PATH for branch $GWM_BRANCH_NAME"
```

---

### 5.4 ログ表示仕様

アプリケーションは、次の情報を必ず表示する。

* hook 開始時:

  * `Running post_create hooks (N commands)...`
* 各コマンド開始前:

  * `  [1/N] pnpm install`
* コマンド失敗時:

  * `post_create hook failed: <command>`
  * `exit code: <code>`（取得できる場合）

---

### 5.5 終了コード仕様

* hook がすべて成功した場合、アプリケーションは従来通り成功終了する（終了コード 0）。
* hook の途中で失敗した場合、アプリケーションは **失敗したコマンドの終了コード**で終了する（一般的な CLI の期待に沿う）。

> 重要: hook 失敗時に worktree を自動削除するかどうかは議論が必要だが、今回は「ユーザーが調査できる状態」を優先し、**作成済み worktree は残す**。

---

## 6. 実装設計

### 6.1 追加/変更する責務

#### 6.1.1 Config ローダ

アプリケーションは「設定ファイルを読む処理」に次を追加する。

* Git リポジトリのルートディレクトリを取得する

  * 推奨: `git rev-parse --show-toplevel` を実行して取得する
* `<repo-root>/gwm/config.toml` の存在確認を行う
* グローバル設定とプロジェクト設定を読み、深いマージで `effective config` を生成する（4.1.2）

#### 6.1.2 Hook ランナー

アプリケーションは `post_create` hook の専用関数を追加する。

* 入力:

  * `config`（effective config）
  * `worktreePath`（今回作成した worktree のパス）
* 出力:

  * 成功: `void`
  * 失敗: 例外（または `Result` 型）で呼び出し元へ伝播

#### 6.1.3 `gwm add` のフロー統合

アプリケーションは worktree 作成処理の最後に hook ランナーを呼び出す（5.1 の順序）。

---

### 6.2 疑似コード

#### 6.2.1 設定ロード（深いマージ）

```ts
type Config = {
  worktree_base_path?: string
  clean_branch?: "auto" | "ask" | "never"
  copy_ignored_files?: { enabled?: boolean; patterns?: string[]; exclude_patterns?: string[] }
  hooks?: { post_create?: { enabled?: boolean; commands?: string[] } }
}

function loadEffectiveConfig(cwd: string): Config {
  const repoRoot = tryGetGitRoot(cwd) // null の場合もあり得る
  const globalConfig = loadGlobalConfigIfExists() // ~/.config/gwm/config.toml, ~/.gwmrc
  const projectConfig = repoRoot ? loadProjectConfigIfExists(repoRoot + "/gwm/config.toml") : null

  return deepMerge(globalConfig, projectConfig)
}
```

#### 6.2.2 post_create 実行

```ts
interface HookContext {
  worktreePath: string
  branchName: string
  repoRoot: string
  repoName: string
}

async function runPostCreateHooks(config: Config, context: HookContext): Promise<void> {
  const hook = config.hooks?.post_create
  if (!hook) return
  if (hook.enabled === false) return
  const commands = hook.commands ?? []
  if (commands.length === 0) return

  // hook 用環境変数を準備
  const hookEnv = {
    ...process.env,
    GWM_WORKTREE_PATH: context.worktreePath,
    GWM_BRANCH_NAME: context.branchName,
    GWM_REPO_ROOT: context.repoRoot,
    GWM_REPO_NAME: context.repoName,
  }

  console.log(`Running post_create hooks (${commands.length} commands)...`)

  for (let i = 0; i < commands.length; i++) {
    const cmd = commands[i]
    console.log(`  [${i + 1}/${commands.length}] ${cmd}`)
    // 推奨: child_process.spawn を利用
    await execShellCommand(cmd, { cwd: context.worktreePath, stdio: "inherit", env: hookEnv })
  }
}
```

---

## 7. テスト仕様（Vitest 前提の案）

> リポジトリ直下に `vitest.config.ts` が存在するため、テストは Vitest を使う前提で記述するのが自然です。 ([GitHub][1])

### 7.1 単体テスト

1. **設定優先順位テスト**

   * グローバル設定: `hooks.post_create.commands = ["echo global"]`
   * プロジェクト設定: `hooks.post_create.commands = ["echo project"]`
   * 期待: effective config の `commands` が `["echo project"]` になる（配列は全置換）

2. **enabled=false テスト**

   * `enabled=false` のとき `runPostCreateHooks` が何も実行しない

### 7.2 結合テスト（可能なら）

一時ディレクトリに Git リポジトリを作成し、`gwm add` を実行して副作用ファイル生成を確認する。

* `hooks.post_create.commands = ["node -e \"require('fs').writeFileSync('hook.txt','ok')\""]`
* 期待: 新規 worktree ディレクトリ直下に `hook.txt` が作成される

---

## 8. ドキュメント更新

### 8.1 README（英語）に追記

* `Configuration file` セクションに「プロジェクト設定として `<repo-root>/gwm/config.toml` を優先する」旨を追記
* `hooks.post_create` の例を追記

### 8.2 README_JA（日本語）に追記

* 同内容を日本語で追記

---

## 9. 後方互換性

* `hooks` セクションが存在しない既存設定ファイルは、そのまま動作する。
* `<repo-root>/gwm/config.toml` が存在しないプロジェクトは、従来通り `~/.config/gwm/config.toml`（または `~/.gwmrc`）で動作する。 ([GitHub][1])

---

## 10. 実装着手チェックリスト（開発者向け）

1. 開発者は、既存コードで「設定ロード」を担当しているモジュールを検索する

   * 目印: `worktree_base_path` / `clean_branch` / `copy_ignored_files` のキー文字列 ([GitHub][1])
2. 開発者は、既存コードで「`gwm add` が worktree を作成する箇所」を特定する
3. 開発者は、worktree 作成成功後（かつ `copy_ignored_files` 完了後）に `runPostCreateHooks` を挿入する
4. 開発者は、設定の優先順位（プロジェクト > グローバル）と深いマージを実装する
5. 開発者は、単体テストで優先順位と逐次実行を検証する
