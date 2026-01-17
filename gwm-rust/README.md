<p align="center">
  <strong>English</strong> | <a href="README.md">日本語</a>
</p>

# gwm – Git Worktree Manager

A CLI tool for managing Git worktrees, allowing you to work on multiple branches simultaneously.

<div align="center">

[![Crates.io](https://img.shields.io/crates/v/gwm?style=flat-square)](https://crates.io/crates/gwm)
[![license MIT](https://img.shields.io/badge/license-MIT-green?style=flat-square)](LICENSE)
[![CI](https://github.com/shutootaki/gwm/actions/workflows/ci-rust.yml/badge.svg)](https://github.com/shutootaki/gwm/actions/workflows/ci-rust.yml)
[![Downloads](https://img.shields.io/crates/d/gwm?style=flat-square)](https://crates.io/crates/gwm)

</div>

<img width="1198" height="517" alt="image" src="https://github.com/user-attachments/assets/13c87aed-83ec-421f-97af-7a1f5992066e" />

## What problem does gwm solve?

When reviewing multiple PRs or working on a hotfix while developing another feature, you end up running `git stash` and `git checkout` repeatedly. gwm uses Git's worktree feature to **manage separate directories for each branch**.

gwm wraps Git's built-in `git worktree` command with an **interactive TUI**, **intuitive commands**, and **useful features** to make worktree management effortless.

- Switch branches without stashing
- Create worktrees from remote branches instantly
- Auto-detect and remove merged worktrees
- Interactive selection with fuzzy search
- Automatic shell directory change after operations

## Commands

| Command                 | Description                          |
| ----------------------- | ------------------------------------ |
| `gwm list` / `gwm ls`   | List worktrees                       |
| `gwm add`               | Create a new worktree                |
| `gwm go`                | Jump to a worktree or open in editor |
| `gwm remove` / `gwm rm` | Remove worktrees                     |
| `gwm clean`             | Detect and remove merged worktrees   |
| `gwm sync`              | Run `git pull` in main worktrees     |

Run `gwm help <command>` for details on each command.

## Installation

### Cargo

```bash
cargo install gwm
```

## Shell integration (cd)

To automatically change your current shell directory after `gwm add` / `gwm go`, add the following to your shell config. This also enables shell completions.

```bash
# Bash (~/.bashrc)
eval "$(gwm init bash)"

# Zsh (~/.zshrc)
eval "$(gwm init zsh)"
```

```fish
# Fish (~/.config/fish/config.fish)
gwm init fish | source
```

## Usage

**Start working on a new branch:**

```bash
gwm add feature/new-login -o code  # Create worktree and open in VS Code
```

**Review a PR:**

```bash
gwm add fix-bug -r -o code   # Create worktree from remote branch and open in VS Code
# After review
gwm remove fix-bug           # Remove it
```

**Clean up old worktrees:**

```bash
gwm clean                    # Detect and remove merged worktrees
```

## Directory Layout

Worktrees are created at:

```
~/git-worktrees/<repository-name>/<branch-name>/
```

Example: `~/git-worktrees/my-app/feature-login/`

## Command Reference

### `gwm list` (alias: `ls`)

List worktrees in the current project.

```text
    BRANCH           SYNC    CHANGES  PATH                     ACTIVITY
[*] feature/new-ui   ↑2 ↓0  3M 1D    ${B}/project/feature...  2h ago
[M] main             ✓      clean    ${B}/project/main        30m ago
[-] hotfix/logfix    ↑0 ↓5  clean    ${B}/project/logfix      3d ago
```

**STATUS meanings:**

- `[*]`: Current worktree
- `[M]`: Main branches (main, master, etc.)
- `[-]`: Other worktrees

**Column meanings:**

- `SYNC`: Sync status with remote (↑=ahead, ↓=behind, ✓=synced)
- `CHANGES`: Local changes (M=Modified, D=Deleted, A=Added, U=Untracked)
- `ACTIVITY`: Time since last update

**Options:**

| Option            | Description                      |
| ----------------- | -------------------------------- |
| `--format <type>` | Output format (table/json/names) |

---

### `gwm add [branch_name]`

Create a new worktree.

**Without arguments (`gwm add`):**

- Opens interactive UI for entering a new branch name
- Press `Tab` to switch to remote branch selection mode

**With arguments:**

- `gwm add feature/new-login`: Create new branch and worktree
- `gwm add existing-branch`: Create worktree from existing local branch
- `gwm add pr-branch -r`: Create worktree from remote branch

**Options:**

| Option                | Description                                     |
| --------------------- | ----------------------------------------------- |
| `-r, --remote`        | Create from remote branch                       |
| `--from <branch>`     | Base branch (default: main or master)           |
| `-o, --open <editor>` | Open in editor after creation (code/cursor/zed) |
| `--no-cd`             | Show success message instead of path output     |
| `--skip-hooks`        | Skip post_create hooks execution                |

**Automatic file copying:**

When `copy_ignored_files` is enabled, `.env` files are automatically copied from the main worktree to the new worktree.

---

### `gwm go [query]`

Select a worktree and jump to it.

With shell integration enabled (see "Shell integration (cd)"), it changes the current shell directory. Otherwise, it launches a subshell.

- `gwm go`: Interactive selection (fuzzy search supported)
- `gwm go feat`: Filter by "feat" and select

**Options:**

| Option                | Description                          |
| --------------------- | ------------------------------------ |
| `-o, --open <editor>` | Open in editor (code/cursor/zed)     |
| `--no-cd`             | Show success message instead of path |

---

### `gwm remove [query]` (alias: `rm`)

Interactively select and remove worktrees. Supports multi-select.

**Options:**

| Option                  | Description                                        |
| ----------------------- | -------------------------------------------------- |
| `-f, --force`           | Force delete even with uncommitted changes         |
| `--clean-branch <mode>` | Delete local branch too (`auto` / `ask` / `never`) |

---

### `gwm clean`

Auto-detect and remove worktrees that are safe to delete.

**A worktree is eligible if:**

1. Remote branch is deleted or merged into main
2. No uncommitted or unpushed local changes
3. Not a main branch or the current worktree

**Options:**

| Option          | Description                  |
| --------------- | ---------------------------- |
| `-n, --dry-run` | Show list only, don't delete |
| `--force`       | Delete without confirmation  |

---

### `gwm sync` (alias: `pull-main`)

Find main branch worktrees (main, master, etc.) and run `git pull` to update them. Works from any directory.

> **Note**: For backward compatibility, the legacy command name `gwm pull-main` is still available.

## Workflow Comparison

### Traditional Git

```bash
# Reviewing a PR
git stash                    # Save current work
git checkout main            # Switch to main
git pull                     # Update main
git checkout pr-branch       # Switch to PR branch
git pull origin pr-branch    # Update PR branch
# ... review work ...
git checkout main            # Back to main
git stash pop                # Restore work
```

### With gwm

```bash
# Reviewing a PR
gwm add pr-branch -r         # Create worktree from remote
gwm go pr-branch             # Jump to review worktree
# ... review work ... (original work untouched)
gwm remove pr-branch         # Remove when done
```

## Help

- `gwm help`: General help
- `gwm help <command>`: Command-specific help
- [GitHub Issues](https://github.com/shutootaki/gwm/issues): Bug reports and feature requests

## Configuration

Customize behavior in `~/.config/gwm/config.toml`.

### Configuration Options

| Option                                | Description                                | Default              |
| ------------------------------------- | ------------------------------------------ | -------------------- |
| `worktree_base_path`                  | Directory to create worktrees              | `~/git-worktrees`    |
| `main_branches`                       | Branch names treated as main branches      | `["main", "master"]` |
| `clean_branch`                        | Delete local branch when removing worktree | `"ask"`              |
| `copy_ignored_files.enabled`          | Copy gitignored files to new worktrees     | `false`              |
| `copy_ignored_files.patterns`         | File patterns to copy                      | `[]`                 |
| `copy_ignored_files.exclude_patterns` | File patterns to exclude from copying      | `[]`                 |
| `hooks.post_create.enabled`           | Run hooks after worktree creation          | `true`               |
| `hooks.post_create.commands`          | Commands to run after creation             | `[]`                 |

**`clean_branch` values:**

- `"auto"`: Auto-delete if safe
- `"ask"`: Prompt for confirmation (default)
- `"never"`: Never delete

### Example Configuration

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

### Project-specific Configuration

Create `.gwm/config.toml` in your repository for project-specific settings. Project settings override global settings.

> **Note**: For backward compatibility, `gwm/config.toml` is also supported but `.gwm/config.toml` is recommended for new projects.

**Example: Use pnpm for this project**

`my-project/.gwm/config.toml`:

```toml
[hooks.post_create]
commands = ["pnpm install"]
```

### Hook Environment Variables

The following environment variables are available during `post_create` hooks:

| Variable            | Description                       |
| ------------------- | --------------------------------- |
| `GWM_WORKTREE_PATH` | Absolute path to the new worktree |
| `GWM_BRANCH_NAME`   | Branch name                       |
| `GWM_REPO_ROOT`     | Git repository root path          |
| `GWM_REPO_NAME`     | Repository name                   |

## License

MIT
