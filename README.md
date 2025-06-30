# gwm – Git Worktree Manager

> ⚡ **Switch Git contexts in milliseconds**. Review pull requests, create feature branches, and clean up your workspace—all from a single interactive CLI.

<div align="center">

[![npm version](https://img.shields.io/npm/v/@shutootaki/gwm?color=blue&style=flat-square)](https://www.npmjs.com/package/@shutootaki/gwm)
[![license MIT](https://img.shields.io/badge/license-MIT-green?style=flat-square)](LICENSE)
[![CI](https://github.com/shutootaki/gwm/actions/workflows/ci.yml/badge.svg)](https://github.com/shutootaki/gwm/actions/workflows/ci.yml)
[![Downloads](https://img.shields.io/npm/dm/@shutootaki/gwm?style=flat-square)](https://www.npmjs.com/package/@shutootaki/gwm)

</div>

## 🚀 Why gwm?

When you're juggling multiple pull requests or hotfixes at once, running `git checkout` and `git pull` over and over or keeping multiple local clones around can slow you down. **gwm** leverages Git's native _worktree_ feature and a pleasant UI to:

- **⚡ Swap tasks in milliseconds** — no more stash/checkout dance
- **🎯 Spin up a worktree from any remote branch in one go**
- **🧹 Keep your laptop squeaky-clean** — detect and safely remove stale branches
- **🎨 Do it all without leaving the terminal** — powered by an Ink-based fuzzy finder


## 📋 Command overview

| Command                 | Purpose                                             | Highlights                                     |
| ----------------------- | --------------------------------------------------- | ---------------------------------------------- |
| `gwm list` / `gwm ls`   | List worktrees in the current repository            | Colored status, HEAD hash                      |
| `gwm add`               | Create a new worktree                               | New branch / remote PR, interactive validation |
| `gwm go`                | Jump to a worktree or open it in VS Code/Cursor     | Launch subshell, editor flags                  |
| `gwm remove` / `gwm rm` | Remove worktrees                                    | Multi-select, force mode, branch cleanup       |
| `gwm clean`             | Auto-detect safe-to-delete worktrees and clean them | Enter deletes all / -n dry-run                 |
| `gwm pull-main`         | Run `git pull` in all main worktrees                | Keep bases up to date                          |

_Note: Run `gwm help <command>` for details on each command._

## 📦 Installation

### npm (Recommended)

```bash
# Global install
npm install -g @shutootaki/gwm

# or use npx (no installation needed)
npx @shutootaki/gwm
```

### Alternative Installation Methods

```bash
# Using pnpm
pnpm add -g @shutootaki/gwm

# Using yarn
yarn global add @shutootaki/gwm

# Using bun
bun add -g @shutootaki/gwm
```

## 🎯 Quick start

```bash
# In a Git repository
$ gwm add                   # Interactive mode: enter branch name → Enter
$ gwm go feature/my-branch  # Jump to the worktree
$ gwm go --code             # Open VS Code instantly
```

When reviewing a pull request:

```bash
$ gwm add 1234-fix-layout -r --code  # Create a worktree from the remote branch and open VS Code immediately 🚀
```

**Weekend cleanup:**

```bash
$ gwm clean             # Clean up safe-to-delete worktrees interactively
```

## 🗂️ Default directory layout

```
~/git-worktrees/
└─ <repo-name>/
   ├─ main/
   ├─ feature-user-auth/
   └─ hotfix-critical-bug/
```

You can change the base path in `~/.config/gwm/config.toml` (or `~/.gwmrc`).

## ⚙️ Configuration file

Create `~/.config/gwm/config.toml` to fine-tune behavior:

```toml
# Base path for worktrees (default: ~/git-worktrees)
worktree_base_path = "/Users/me/dev/worktrees"

# What to do with the local branch when deleting a worktree
#   "auto"  – delete automatically when safe
#   "ask"   – prompt for confirmation (default)
#   "never" – never delete
clean_branch = "ask"

# Main branches to use as base for new branches
main_branches = ["main", "master", "develop"]
```

## 📖 Command reference

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
  - `--cd`: After creation, go to the directory where the corresponding work tree exists.

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
  - `-n, --dry-run`: Show the list only; don't delete.
  - `--force`: Skip confirmation and delete immediately.

---

### `gwm pull-main`

Regardless of where you are, find worktrees of main branches (`main`, `master`, etc.) and run `git pull` to bring them up to date.

## 🔄 Workflow Comparison

### Before gwm (Traditional Git)
```bash
# Reviewing a PR
git stash                    # Save current work
git checkout main           # Switch to main
git pull                    # Update main
git checkout pr-branch      # Switch to PR branch
git pull origin pr-branch   # Update PR branch
# ... review work ...
git checkout main           # Back to main
git stash pop               # Restore work
```

### After gwm
```bash
# Reviewing a PR
gwm add pr-branch -r        # Create worktree from remote
gwm go pr-branch           # Jump to review
# ... review work ... (your main work is untouched)
gwm remove pr-branch       # Clean up when done
```

## 🆚 Comparison with other tools

| Feature | gwm | git-worktree (raw) | multiple clones |
|---------|-----|-------------------|-----------------|
| Setup time | Seconds | Minutes | Minutes |
| Disk usage | Efficient | Efficient | Wasteful |
| Context switching | Instant | Manual | Manual |
| Cleanup | Automated | Manual | Manual |
| PR review | One command | Multiple commands | Multiple commands |
| Learning curve | Gentle | Steep | None |

## 🛠️ Troubleshooting

### Common Issues

**Q: `gwm` command not found**
```bash
# Make sure gwm is installed globally
npm list -g @shutootaki/gwm

# If not installed, install it
npm install -g @shutootaki/gwm
```

**Q: Permission denied when creating worktrees**
```bash
# Check if the base directory exists and is writable
ls -la ~/git-worktrees/

# Create the directory if it doesn't exist
mkdir -p ~/git-worktrees/
```

**Q: Remote branch not found**
```bash
# Fetch the latest remote information
git fetch --all

# Then try creating the worktree again
gwm add your-branch -r
```

**Q: VS Code/Cursor not opening**
```bash
# Make sure the editor is installed and in PATH
which code     # for VS Code
which cursor   # for Cursor

# Install VS Code command line tools
# In VS Code: Cmd+Shift+P → "Shell Command: Install 'code' command"
```

### Getting Help

- Run `gwm help` for general help
- Run `gwm help <command>` for specific command help
- Check the [GitHub Issues](https://github.com/shutootaki/gwm/issues) for known problems
- Create a new issue if you encounter a bug

## 🤝 Contributing

We welcome contributions! Here's how you can help:

### Development Setup

```bash
# Clone the repository
git clone https://github.com/shutootaki/gwm.git
cd gwm

# Install dependencies
pnpm install

# Run in development mode
pnpm run dev

# Run tests
pnpm test

# Build for production
pnpm run build
```

### Contributing Guidelines

1. **Fork the repository** and create your feature branch
2. **Write tests** for new functionality
3. **Follow the existing code style** (we use Prettier and ESLint)
4. **Update documentation** if needed
5. **Submit a pull request** with a clear description

### Areas We Need Help With

- 🐛 **Bug fixes** - Help us squash bugs
- 🎨 **UI improvements** - Make the CLI even more beautiful
- 📚 **Documentation** - Improve guides and examples
- 🌐 **Translations** - Help translate to other languages
- ⚡ **Performance** - Optimize command execution
- 🧪 **Testing** - Improve test coverage

## 📄 License

MIT © 2024 Shuto Otaki and contributors

---

<div align="center">

**⭐ Star this project if you find it useful!**

[Report Bug](https://github.com/shutootaki/gwm/issues) · [Request Feature](https://github.com/shutootaki/gwm/issues) · [Contribute](https://github.com/shutootaki/gwm/blob/main/CONTRIBUTING.md)

</div>
