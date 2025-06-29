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
