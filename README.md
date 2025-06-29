# gwm – Git Worktree Manager

> Switch Git contexts with zero friction. Review pull requests, create feature branches, and clean up your workspace—all from a single interactive CLI.

[![npm version](https://img.shields.io/npm/v/gwm?color=blue&style=flat-square)](https://www.npmjs.com/package/gwm)
[![license MIT](https://img.shields.io/badge/license-MIT-green?style=flat-square)](LICENSE)
[![CI](https://github.com/your-org/gwm/actions/workflows/ci.yml/badge.svg)](https://github.com/your-org/gwm/actions/workflows/ci.yml)

## Why gwm?

When you're juggling multiple pull requests or hotfixes at once, running `git checkout` and `git pull` over and over or keeping multiple local clones around can slow you down. **gwm** leverages Git's native _worktree_ feature and a pleasant UI to:

- **Swap tasks in milliseconds** — no more stash/checkout dance.
- **Spin up a worktree from any remote branch in one go**.
- **Keep your laptop squeaky-clean** — detect and safely remove stale branches.
- **Do it all without leaving the terminal** — powered by an Ink-based fuzzy finder.

## Command overview

| Command                 | Purpose                                         | Highlights                                     |
| ----------------------- | ----------------------------------------------- | ---------------------------------------------- |
| `gwm list` / `gwm ls`   | List worktrees in the current repository        | Colored status, HEAD hash                      |
| `gwm add`               | Create a new worktree                           | New branch / remote PR, interactive validation |
| `gwm go`                | Jump to a worktree or open it in VS Code/Cursor | Launch subshell, editor flags                  |
| `gwm remove` / `gwm rm` | Remove worktrees                                | Multi-select, force mode, branch cleanup       |
| `gwm clean`             | Auto-clean merged/deleted branches              | Safety checks & confirmation                   |
| `gwm pull-main`         | Run `git pull` in all main worktrees            | Keep bases up to date                          |

_Note: Run `gwm help <command>` for details on each command._

## Installation

### npm (global)

```bash
npm install -g gwm
```

## Quick start

```bash
# Inside a Git repo
$ gwm add                   # Interactive: type branch name → Enter
$ gwm go feature/my-branch  # Jump into the worktree
$ code .                    # or use `gwm go --code` to open VS Code right away
```

Reviewing a pull request:

```bash
$ gwm add 1234-fix-layout -r  # Create a worktree from a remote branch
$ gwm go                      # Fuzzy search and teleport 🚀
```

Weekend cleanup:

```bash
$ gwm clean --yes             # Bulk-delete merged/deleted worktrees safely
```

## Default directory layout

```
~/git-worktrees/
└─ <repo-name>/
   ├─ main/
   ├─ feature-user-auth/
   └─ hotfix-critical-bug/
```

You can change the base path in `~/.config/gwm/config.toml` (or `~/.gwmrc`).

## Configuration file

Create `~/.config/gwm/config.toml` to fine-tune behavior:

```toml
# Base path for worktrees (default: ~/git-worktrees)
worktree_base_path = "/Users/me/dev/worktrees"

# What to do with the local branch when deleting a worktree
#   "auto"  – delete automatically when safe
#   "ask"   – prompt for confirmation (default)
#   "never" – never delete
clean_branch = "ask"
```

## Command reference

Below are the main commands. Run `gwm <command> --help` for more information.

### `gwm list` (alias: `ls`)

List worktrees that belong to the current project.

```text
STATUS  BRANCH            PATH                              HEAD
*       feature/new-ui    /Users/me/project                 a1b2c3d
M       main              ~/git-worktrees/project/main      123abc4
-       hotfix/logfix     ~/git-worktrees/project/logfix    c7d8e9f
```

- **STATUS meanings:**
  - `* ACTIVE`: The worktree you're currently in
  - `M MAIN`: Main branches such as `main` or `master`
  - `- OTHER`: Any other worktree

---

### `gwm add [branch_name]`

Create a new worktree. Comes with an interactive UI.

- **Run without arguments (`gwm add`):**
  - Launches a UI to type a new branch name. Branch names are validated in real time and the path preview is shown.
  - Press `Tab` to switch to mode for selecting a remote branch to create a worktree from—perfect for reviewing PRs.
  - You can pass flags to immediately open the worktree in VS Code or Cursor.

- **Run with arguments:**
  - `gwm add feature/new-login`: Create a new branch and worktree named `feature/new-login`.
  - `gwm add existing-branch`: Create a worktree from an existing local branch `existing-branch`.
  - `gwm add pr-branch -r`: Create a worktree from the remote branch `origin/pr-branch`.

- **Key options:**
  - `-r, --remote`: Switch to mode for creating from a remote branch.
  - `--from <base_branch>`: Base branch for new branches (default: `main` or `master`).
  - `--code`: Open in VS Code after creation.
  - `--cursor`: Open in Cursor after creation.
  - `--cd`: Output only the path after creation.

---

### `gwm go [query]`

Fuzzy-find a worktree and jump into it (launches a subshell).

- Run `gwm go` for interactive selection or supply an initial query, e.g., `gwm go feat`.
- **Key options:**
  - `--code`, `-c`: Open the selected worktree in Visual Studio Code.
  - `--cursor`: Open the selected worktree in Cursor.

---

### `gwm remove [query]` (alias: `rm`)

Interactively select and delete one or more worktrees.

- Run `gwm remove` to choose from a list and delete.
- **Key options:**
  - `-f, --force`: Delete even if there are uncommitted changes.
  - `--clean-branch <mode>`: Decide whether to delete the local branch along with the worktree (`auto` / `ask` / `never`).

---

### `gwm clean`

Automatically detect and clean up worktrees that are safe to delete.

A worktree is eligible if:

1. The remote branch has been deleted or merged into the main branch
2. There are no local changes (uncommitted or unpushed commits)
3. It is not the main branch or the worktree you're currently in

- **Key options:**
  - `-y, --yes`: Skip the confirmation prompt before deletion.

---

### `gwm pull-main`

Regardless of where you are, find worktrees of main branches (`main`, `master`, etc.) and run `git pull` to bring them up to date.

## License

MIT © 2024 Shuto Otaki and contributors
