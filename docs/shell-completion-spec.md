# gwm Autocomplete 機能 仕様書（方針A: 単一ソース → 変換）

- 対象リポジトリ: gwm（Git worktree manager CLI） ([GitHub][1])
- 作成日: 2025-12-20
- 仕様書バージョン: 1.0

---

## 1. 目的

本仕様書は、CLI ツール **gwm** に対して、次の 2 種類の補完機能（オートコンプリート機能）を追加するための、実装可能なレベルの詳細仕様を定義する。

1. **標準のシェル補完**（bash / zsh / fish の Tab 補完）
2. **Kiro CLI（旧 Amazon Q Developer CLI / 旧 Fig）系の補完**（ポップアップ候補・インライン候補）

本仕様書は、次の「方針A（おすすめ）」を前提にする。

- gwm に **「補完定義の単一ソース（Single Source of Truth）」**を新設する
- 単一ソースから、
  - シェル補完スクリプト（bash/zsh/fish）
  - Fig 互換の completion spec（Kiro CLI が読み込む形式）
    を **自動生成**する

---

## 2. 背景と前提

### 2.1 gwm のコマンド構造（現行）

gwm は、少なくとも次のサブコマンド群を持つ（README の説明に基づく）。 ([GitHub][1])

- `gwm list` / `gwm ls`
- `gwm add [branch_name]`
- `gwm go [query]`
- `gwm remove [query]` / `gwm rm`
- `gwm clean`
- `gwm pull-main`
- `gwm help` / `gwm help <command>`（README の「Getting Help」より） ([GitHub][1])

### 2.2 Kiro CLI 側の補完の前提

- Kiro CLI は「オートコンプリートのドロップダウン」機能を提供する。 ([Kiro][2])
- Fig 互換の completion spec は、（Fig の非 dev mode では）`~/.fig/autocomplete/build` に置かれたファイルから読み込まれる。 ([Fig][3])
- Kiro CLI は（少なくとも 2025-12 時点の報告では）**legacy path `~/.fig/autocomplete/build/<cli-name>.js` を参照する挙動がある**が、Kiro の公式ドキュメントには明記されていない（Issue 報告）。 ([GitHub][4])

### 2.3 本仕様書の設計方針（重要）

- 本実装は、ユーザーのシェル設定ファイル（例: `~/.zshrc`）を **ユーザー許可なしに自動改変しない**。
  - 背景として、Kiro CLI がインストール時にシェル設定を改変する挙動に対して「同意なしで intrusive」という問題提起が存在する。 ([GitHub][5])

- したがって、gwm は **明示的な install コマンド**を提供し、ユーザーが自分で実行する運用を標準とする。

---

## 3. スコープ

### 3.1 本仕様書のスコープ（やること）

1. 補完定義の単一ソースを gwm 内部に追加する
2. 単一ソースから次を生成できるようにする
   2.1 bash / zsh / fish の補完スクリプト
   2.2 Fig 互換 completion spec（TypeScript → JavaScript へビルドした成果物）
3. 実行時の動的候補（例: worktree 名、ブランチ名）を、可能な範囲で提供する
4. ユーザー向けの install / uninstall / status コマンドを追加する

### 3.2 本仕様書のスコープ外（やらないこと）

- withfig/autocomplete（公開リポジトリ）へ spec を投稿して「世界中のユーザーに自動配布」する作業は、本仕様書の必須要件に含めない（将来拡張扱い）。
- PowerShell の補完は本仕様書の必須要件に含めない。

---

## 4. 用語

- **補完定義の単一ソース**: gwm の全コマンド・全オプション・全引数・候補生成ルールを 1 か所に集約した内部データ
- **標準シェル補完**: bash/zsh/fish が提供する Tab 補完の仕組み
- **completion spec**: Fig 互換の宣言的スキーマ（`Fig.Spec`）で、サブコマンド・オプション・引数・候補生成を定義する ([Fig][6])
- **generator**: completion spec 側で「スクリプトを実行して候補を生成する」仕組み（`script` と `postProcess` を持つ） ([Fig][7])

---

## 5. ユーザー体験（User Experience）

### 5.1 標準シェル補完の導入体験

ユーザーは、次のいずれかの方法で標準シェル補完を有効化できる。

- 方法A（推奨）: `gwm completion install --shell zsh` のように install コマンドを実行する
- 方法B: `gwm completion script --shell zsh` を実行して、ユーザーが自分の設定ファイルに `source` を追記する

### 5.2 Kiro CLI（Fig）補完の導入体験

ユーザーは、次のコマンドで completion spec を配置できる。

- `gwm completion install --kiro`
  - 実体は `~/.fig/autocomplete/build/gwm.js` にファイルを配置する（Kiro CLI が参照する legacy path を狙う）。 ([GitHub][4])

---

## 6. 要件

## 6.1 機能要件

### F-1: 単一ソースの導入

実装者は、gwm 内部に **補完定義の単一ソース**を追加しなければならない。
単一ソースは、次の情報を保持しなければならない。

- ルートコマンド名: `gwm`
- サブコマンド一覧
- 各サブコマンドの別名（例: `list` の別名 `ls`）
- 各サブコマンドのオプション一覧（short/long、引数の有無、説明）
- 各サブコマンドの位置引数一覧（必須/任意、候補生成ルール）
- 動的候補を生成するための「候補プロバイダ」参照

### F-2: 標準シェル補完生成

実装者は、単一ソースから **bash / zsh / fish** 向けの補完スクリプトを生成できなければならない。

- bash: `complete` + 関数呼び出し方式
- zsh: `_gwm` 関数（`compdef`）方式
- fish: `complete` コマンド登録方式

### F-3: Fig 互換 completion spec 生成

実装者は、単一ソースから **Fig 互換 completion spec** を生成できなければならない。

- spec は TypeScript で記述して `export default` で出力しなければならない ([Fig][6])
- spec の `name` は `gwm` でなければならない（Fig は `name` を利用して spec をロードする） ([Fig][6])
- spec は JavaScript にビルドして、Kiro/ Fig が読み込めるファイルとして配置できなければならない ([GitHub][4])

### F-4: 動的候補（最低限）

実装者は、次の動的候補を提供しなければならない。

1. `gwm go [query]` の `query` 候補: 現在のリポジトリの worktree 一覧（ブランチ名相当）
2. `gwm remove [query]` の `query` 候補: 現在のリポジトリの worktree 一覧（ブランチ名相当）
3. `gwm add --from <base_branch>` の `<base_branch>` 候補: ローカルブランチ一覧
4. `gwm add -r/--remote` を指定したときの `branch_name` 候補: リモートブランチ一覧（origin）

### F-5: install / uninstall / status

実装者は、次のユーザー向けコマンドを提供しなければならない。

- `gwm completion install ...`
- `gwm completion uninstall ...`
- `gwm completion status ...`

## 6.2 非機能要件

### N-1: 安全性

- install コマンドは、ユーザーの設定ファイルを更新する場合に、**差分が idempotent（複数回実行しても重複しない）**になるように実装しなければならない。
- install コマンドは、デフォルトではシェル設定ファイルを改変してはならない（`--modify-rc` がある場合のみ改変してよい）。

### N-2: 性能

- 動的候補生成のために gwm が内部で Git コマンドを実行する場合、候補生成は **通常ケースで 100 ミリ秒以内**を目標にする。
- Kiro/Fig の generator は頻繁に実行され得るため、gmw 側の候補生成コマンドは **短いキャッシュ（例: 1 秒）**を持つべきである。

### N-3: 移植性

- macOS と Linux を第一対象にする。
- Windows は本仕様書の必須対象に含めない。

---

## 7. コマンド仕様（gwm completion）

### 7.1 コマンド一覧

gwm に次のトップレベルサブコマンドを追加する。

- `gwm completion`

`gwm completion` は、次のサブコマンドを持つ。

| サブコマンド            | 目的                                         |
| ----------------------- | -------------------------------------------- |
| `script`                | 指定シェル用の補完スクリプトを標準出力へ出す |
| `install`               | 補完をインストールする（ファイル配置）       |
| `uninstall`             | 補完をアンインストールする                   |
| `status`                | インストール状況を表示する                   |
| `__complete`            | （内部用）標準シェル補完が呼び出す候補生成   |
| `__fig_worktrees`       | （内部用）Fig generator 向け候補生成         |
| `__fig_branches_local`  | （内部用）Fig generator 向け候補生成         |
| `__fig_branches_remote` | （内部用）Fig generator 向け候補生成         |

`__*` 系サブコマンドは help には表示しない（隠しコマンド扱い）ことを MUST とする。

---

## 8. 補完定義の単一ソース（Single Source of Truth）

### 8.1 配置場所

実装者は、次のいずれかの構成で単一ソースを配置する。

- 推奨: `src/completion/definition.ts`
- 代替: `src/completion/definition.json`（ただし型安全性が落ちるため推奨しない）

### 8.2 型（TypeScript interface の仕様）

実装者は、少なくとも次の情報構造を満たす型を定義する。

```ts
export type CompletionProviderId =
  | 'worktrees'
  | 'localBranches'
  | 'remoteBranchesOrigin';

export type CompletionArg = {
  name: string; // 表示名
  description?: string;
  required: boolean;
  isVariadic?: boolean;
  providers?: CompletionProviderId[]; // 動的候補
};

export type CompletionOption = {
  names: string[]; // ["-r", "--remote"] のように複数持てる
  description?: string;
  takesValue: boolean;
  valueArg?: CompletionArg; // takesValue=true のとき
};

export type CompletionCommand = {
  name: string; // 例: "add"
  aliases?: string[]; // 例: ["ls"]
  description?: string;
  options?: CompletionOption[];
  args?: CompletionArg[];
  subcommands?: CompletionCommand[]; // "completion" の下に "install" など
};

export type CompletionDefinition = {
  rootName: 'gwm';
  commands: CompletionCommand[];
};
```

### 8.3 定義内容（gwm 現行コマンド）

実装者は、README の仕様に従って、次のコマンドとオプションを単一ソースに登録しなければならない。 ([GitHub][1])

#### 8.3.1 `list` / `ls`

- `gwm list`
- `gwm ls`

#### 8.3.2 `add [branch_name]`

- 引数:
  - `branch_name`（任意）

- オプション（README 記載） ([GitHub][1])
  - `-r`, `--remote`（値なし）
  - `--from <base_branch>`（値あり）
  - `--code`（値なし）
  - `--cursor`（値なし）
  - `--cd`（値なし）

#### 8.3.3 `go [query]`

- 引数:
  - `query`（任意）

- オプション（README 記載） ([GitHub][1])
  - `-c`, `--code`（値なし）
  - `--cursor`（値なし）

#### 8.3.4 `remove [query]` / `rm`

- 引数:
  - `query`（任意）

- オプション（README 記載） ([GitHub][1])
  - `-f`, `--force`（値なし）
  - `--clean-branch <mode>`（値あり / mode は `auto` / `ask` / `never`）

#### 8.3.5 `clean`

- オプション（README 記載） ([GitHub][1])
  - `-n`, `--dry-run`（値なし）
  - `--force`（値なし）

#### 8.3.6 `pull-main`

- オプションは本仕様書では未定義（README には明記なし） ([GitHub][1])
  - 将来オプションが追加された場合、単一ソースに追記する。

#### 8.3.7 `help`

- 引数:
  - `command`（任意、候補は gwm のサブコマンド名）

---

## 9. 標準シェル補完の仕様

## 9.1 標準シェル補完の候補生成プロトコル（gwm 側）

実装者は、標準シェル補完用の内部コマンド `gwm completion __complete` を実装しなければならない。

### 9.1.1 入力（引数）

`__complete` は、次の形式で呼び出されることを前提にする。

- 共通:
  - `--shell <bash|zsh|fish>`
  - `--cword <number>`（現在補完中のトークン index）
  - `--` 以降に、すでに入力済みの token 列（`gwm` 自体は除く）

例（概念）:

- `gwm completion __complete --shell bash --cword 2 -- go fe`

### 9.1.2 出力（標準出力）

`__complete` は、候補を 1 行ずつ出力する。

- 形式: `候補文字列\t説明（任意）`
- 説明が不要な場合は `\t` を省略してよい

例:

```
go	Find a worktree and jump into it
add	Create a new worktree
```

## 9.2 コンテキスト解釈（パーサ仕様）

実装者は、`__complete` の内部で次の順序で入力 token を解釈しなければならない。

1. サブコマンドが未確定の場合は、ルートコマンドのサブコマンド候補を返す
2. サブコマンドが確定している場合は、そのコマンド定義を取得する
3. すでに入力済みのオプションを走査し、次の状態を決める
   - 「今からオプション名を補完する状態」
   - 「今からオプション値を補完する状態」
   - 「今から位置引数を補完する状態」

4. 状態に応じて候補を生成する

## 9.3 候補生成ルール（標準シェル補完）

### 9.3.1 サブコマンド候補

- ルートでは、`list/ls/add/go/remove/rm/clean/pull-main/help/completion` を候補に含める
- すでに入力されている prefix がある場合は prefix フィルタを適用する

### 9.3.2 オプション候補

- 現在のコマンド定義が持つオプションを候補に含める
- すでに入力済みのオプション（同一 long/short）は候補から除外する（ただし複数回指定が意味を持つ設計にした場合は除外しない）
- 現在補完中 token が `-` から始まる場合は、オプション候補を優先する

### 9.3.3 オプション値候補

- `--clean-branch <mode>` の `<mode>` は `auto/ask/never` を返す
- `--from <base_branch>` の `<base_branch>` はローカルブランチ一覧を返す（動的）
- `add -r/--remote` の文脈では、`branch_name` はリモートブランチ一覧を返す（動的）

### 9.3.4 位置引数候補

- `go [query]` と `remove [query]` は worktree 一覧を返す（動的）
- `help [command]` はサブコマンド名一覧を返す（静的）

---

## 10. 動的候補プロバイダ（gwm 側）

実装者は、次のプロバイダ関数群を実装しなければならない。

| ProviderId             | 返す候補                                                        | 主な利用箇所               |
| ---------------------- | --------------------------------------------------------------- | -------------------------- |
| `worktrees`            | worktree のブランチ名相当（gwm が管理している worktree 一覧）   | `go query`, `remove query` |
| `localBranches`        | ローカルブランチ一覧                                            | `add --from`               |
| `remoteBranchesOrigin` | `origin/*` のリモートブランチ一覧（`origin/` を除去してもよい） | `add -r`                   |

### 10.1 Git リポジトリ外での挙動

ユーザーが Git リポジトリ外で補完を起動した場合、実装者は次の挙動を実装しなければならない。

- `worktrees/localBranches/remoteBranchesOrigin` は空配列を返す
- `__complete` はエラー終了しない（補完が壊れないことを優先する）

### 10.2 キャッシュ仕様

実装者は、Kiro/Fig generator の高頻度実行に備えて、次のキャッシュを実装すべきである。

- キャッシュ単位:
  - カレントディレクトリの Git リポジトリ（`git rev-parse --show-toplevel` の結果）
  - ProviderId

- 有効期限:
  - 1 秒（推奨）

- 保存場所:
  - プロセスメモリ内キャッシュ（同一プロセス内）
  - 追加でファイルキャッシュを実装してもよい（ただし必須ではない）

---

## 11. Fig / Kiro CLI 向け completion spec の仕様

## 11.1 spec の基本構造

実装者は、Fig のドキュメントに従い、次の構造を満たす `Fig.Spec` を出力しなければならない。 ([Fig][6])

- `const completionSpec: Fig.Spec = { name: "gwm", ... }`
- `export default completionSpec`

## 11.2 generator の利用指針

実装者は、動的候補が必要な引数に対して generator を割り当てる。
generator は `script` と `postProcess` により候補を作る。 ([Fig][7])

### 11.2.1 generator の script 実行内容

実装者は、Fig generator の `script` で次の gwm サブコマンドを呼び出す。

- worktree 候補:
  - `gwm completion __fig_worktrees`

- local branch 候補:
  - `gwm completion __fig_branches_local`

- remote branch 候補:
  - `gwm completion __fig_branches_remote`

### 11.2.2 generator の出力フォーマット

上記 `__fig_*` は、次の単純形式を標準出力へ出す。

- 1 行 1 候補
- 形式は `name\tdescription(任意)` を許容する

spec 側の `postProcess` は、行分割して `Suggestion` を返す（Fig ドキュメントの例と同型）。 ([Fig][8])

---

## 12. インストール仕様

## 12.1 `gwm completion install`（標準シェル補完）

### 12.1.1 オプション

- `--shell <bash|zsh|fish>`（必須）
- `--dry-run`（任意、ファイル書き込みを行わず表示のみ）
- `--modify-rc`（任意、ユーザーの rc ファイルへの追記を許可する）
- `--path <dir>`（任意、補完ファイルの配置先を明示指定）

### 12.1.2 デフォルト配置先

実装者は、デフォルト配置先を次の通りにする。

- bash:
  - `~/.local/share/bash-completion/completions/gwm`（推奨）

- zsh:
  - `~/.zsh/completions/_gwm`（推奨）

- fish:
  - `~/.config/fish/completions/gwm.fish`

### 12.1.3 rc ファイル更新（`--modify-rc` 指定時のみ）

実装者は、`--modify-rc` が指定された場合のみ、次の追記を行ってよい。

- zsh:
  - `~/.zshrc` に `fpath=(~/.zsh/completions $fpath)` と `compinit` まわりの案内（ただし既存設定を壊さない）

- bash:
  - `~/.bashrc` に bash-completion 読み込みが不足している場合の案内

- fish:
  - fish は自動で `~/.config/fish/completions` を読むため、通常は追記不要

実装者は、追記箇所を次のマーカーで囲み、アンインストール可能にしなければならない。

- `# >>> gwm completion >>>`
- `# <<< gwm completion <<<`

## 12.2 `gwm completion install --kiro`（Fig spec 配置）

### 12.2.1 配置先

実装者は、次のパスに `gwm.js` を配置する。

- `~/.fig/autocomplete/build/gwm.js` ([Fig][3])

### 12.2.2 ビルド成果物

実装者は、npm パッケージに次の成果物を含めなければならない。

- `dist/fig/gwm.js`（CommonJS でも ES Modules でもよいが、Kiro/Fig が読み込める形式にする）

---

## 13. ビルド仕様（開発者向け）

実装者は、次のビルド成果物を生成する。

- `dist/completions/gwm.bash`
- `dist/completions/_gwm`
- `dist/completions/gwm.fish`
- `dist/fig/gwm.js`

実装者は、CI で次を検証する。

- 単一ソース → 生成物が再現可能（差分が安定）
- `__complete` がエラー終了しない
- Git リポジトリ外でも安全に空候補を返す

---

## 14. テスト仕様

## 14.1 単体テスト

実装者は、次の単体テストを追加しなければならない。

1. ルート補完（`gwm <TAB>`）がサブコマンドを返す
2. `gwm add --<TAB>` が `--from/--remote/--code/--cursor/--cd` を返す ([GitHub][1])
3. `gwm remove --clean-branch <TAB>` が `auto/ask/never` を返す ([GitHub][1])
4. Git リポジトリ外で `__complete` が 0 exit code で終了する

## 14.2 スナップショットテスト

実装者は、生成した補完スクリプト（bash/zsh/fish）をスナップショットで検証しなければならない。

---

## 15. README 更新仕様（ユーザー向けドキュメント）

実装者は、README に次の章を追加しなければならない。

- `## Autocomplete`
  - 標準シェル補完（bash/zsh/fish）の install 方法
  - Kiro CLI（Fig）向け補完の install 方法
  - uninstall 方法
  - 既知の注意点（Kiro CLI が `~/.fig/autocomplete/build` を参照する挙動は現状 Issue ベースで、将来変わる可能性があること） ([GitHub][4])

---

## 16. 実装者向けの最小ファイル構成（提案）

```
src/
  completion/
    definition.ts                 # 単一ソース
    providers/
      worktrees.ts                # worktree 候補
      branches_local.ts           # local branches 候補
      branches_remote.ts          # remote branches 候補
    runtime/
      complete.ts                 # __complete の本体（解析・候補生成）
    generators/
      shell/
        bash.ts                   # bash スクリプト生成
        zsh.ts                    # zsh スクリプト生成
        fish.ts                   # fish スクリプト生成
      fig/
        spec.ts                   # Fig.Spec 生成（単一ソース→Fig.Spec）
  commands/
    completion.ts                 # gwm completion コマンド群
dist/
  completions/...
  fig/...
```

---

## 17. 受け入れ条件（Definition of Done）

実装完了は、次の条件をすべて満たしたときに成立する。

1. `gwm completion install --shell zsh` が成功し、zsh で `gwm <TAB>` が動作する
2. `gwm completion install --kiro` が成功し、`~/.fig/autocomplete/build/gwm.js` が作成される ([Fig][3])
3. `gwm go <TAB>` が worktree 候補を出す
4. `gwm remove <TAB>` が worktree 候補を出す
5. `gwm add --from <TAB>` がローカルブランチ候補を出す
6. Git リポジトリ外で補完が壊れない
7. README に導入方法が追加されている
