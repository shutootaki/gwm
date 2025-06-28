# gwm - Git Worktree Manager

A modern CLI tool for efficient Git worktree management with an interactive, React-based terminal UI built with Ink.

## Overview

`gwm` simplifies Git worktree management for developers who need to:

- Review and test GitHub pull requests locally with quick context switching
- Work on multiple features or bug fixes in parallel while maintaining clean, isolated environments
- Automate worktree creation from remote branches and cleanup of merged branches

## Features

- **Interactive UI**: fzf-like fuzzy search and multi-selection for all operations
- **Intuitive Commands**: Simple, single-purpose commands with consistent behavior
- **Smart Status Detection**: Automatically identifies merged, deleted, and prunable worktrees
- **Shell Integration**: Seamless directory navigation with shell functions
- **VS Code Integration**: Open worktrees directly in your editor
- **Flexible Configuration**: Customize base paths and main branches via TOML configuration
- **TypeScript & React**: Built with modern technologies for maintainable, extensible code

## Installation

### Prerequisites

- Node.js 16+
- Git 2.25+

### From npm (Coming Soon)

```bash
npm install -g gwm
```

### From Source

```bash
git clone https://github.com/shutootaki/gwm.git
cd gwm
pnpm install
pnpm build
pnpm link --global
```

## Commands

### `gwm list` (alias: `ls`)

Display all worktrees with their status, branch, path, and commit information.

```bash
gwm list
```

**Status Indicators:**

- `* ACTIVE`: Currently active worktree
- `NORMAL`: Standard worktree
- `PRUNABLE`: Merged or deleted branches (cleanup candidates)
- `LOCKED`: Git-locked worktrees

### `gwm add [branch_name]`

Add a new worktree from a branch. Without arguments, launches interactive remote branch selection.

```bash
# Interactive mode - select from remote branches
gwm add

# Add from local branch (or new branch if doesn't exist)
gwm add feature/new-ui

# Add from remote branch
gwm add -r feature/api-update

# Add new branch from specific base
gwm add new-feature --from main
```

**Options:**

- `-r, --remote`: Treat branch_name as remote branch (fetch and track)
- `--from <branch>`: Specify base branch for new branch creation (defaults to main)

### `gwm remove` (alias: `rm`)

Remove one or more worktrees with interactive multi-selection.

```bash
# Interactive selection
gwm remove

# Pre-filter with query
gwm remove feature

# Force removal
gwm remove -f
```

**Options:**

- `-f, --force`: Force removal even with uncommitted changes

### `gwm clean`

Clean up merged or deleted worktrees. Identifies worktrees where branches have been merged into main branches or deleted from remote.

```bash
# Interactive cleanup with multi-selection
gwm clean

# Auto-cleanup all detected candidates
gwm clean -y
```

**Detection Criteria:**

- Branch is merged into one of the configured main branches
- Remote tracking branch no longer exists

**Options:**

- `-y, --yes`: Skip interactive selection and remove all detected candidates

### `gwm go [query]`

Navigate to or open a worktree directory.

- Without options: Starts a subshell **already located** at the selected worktree path. When the subshell exits, `gwm` also終了します。
- `--code`: Open the selected worktree in **VS Code** and exit.
- `--cursor`: Open the selected worktree in **Cursor** and exit.

```bash
# Interactive selection & move into the **directory** (subshell)
gwm go

# Pre-filter selection with a query string
gwm go feature

# Open the worktree directly in VS Code
gwm go api-refactor --code

# Open the worktree in Cursor editor
gwm go bugfix/login --cursor
```

### `gwm pull-main`

Updates the worktree for the main branch to its latest state, even when your current directory is outside of the worktree directory.

```bash
# Update the main branch
gwm pull-main
```

**Use cases:**

- Your worktree directories live in a specific folder (e.g., `~/username/git-worktree`) and you can't easily update the main branch.

## Configuration

Add a configuration file at `~/.config/gwm/config.toml`:

```toml
# Base directory for worktrees (default: ~/worktrees)
worktree_base_path = "/Users/myuser/dev/worktrees"

# Main branches for merge detection and default base (default: ["main", "master", "develop"])
main_branches = ["main", "master", "develop"]
```

### Worktree Path Convention

Worktrees are created following this pattern:

```
<worktree_base_path>/<repository-name>/<normalized-branch-name>
```

**Branch Name Normalization:**

- Slashes are converted to hyphens for filesystem compatibility
- Examples:
  - `feature/user-auth` → `feature-user-auth`
  - `hotfix/critical-bug` → `hotfix-critical-bug`

**Example Paths:**

```
~/worktrees/myproject/main
~/worktrees/myproject/feature-user-auth
~/worktrees/myproject/hotfix-critical-bug
```

## Usage Examples

### Typical Workflow

```bash
# List current worktrees
gwm list

# Add worktree for PR review
gwm add -r feature/new-dashboard

# Work on the feature...

# Navigate between worktrees via interactive selector
gwm go main        # Switch to main branch (interactive if multiple match)
gwm go dashboard   # Switch back to feature

# Open different worktree in VS Code
gwm go api-refactor --code

# Clean up when done
gwm clean       # Interactive cleanup
gwm remove      # Remove specific worktrees
```

### Command Examples

```bash
# Interactive branch selection for new worktree
gwm add

# Add worktree from remote branch
gwm add -r hotfix/critical-bug

# Add new feature branch from main
gwm add new-feature --from main

# Multi-select worktree removal
gwm remove feature

# Auto-cleanup merged branches
gwm clean -y

# Quick navigation with fuzzy search
gwm go dash        # Matches "feature-dashboard"
```

## Development

### Setup

```bash
git clone https://github.com/shutootaki/gwm.git
cd gwm
pnpm install
```

### Available Scripts

```bash
pnpm dev                # Watch mode compilation
pnpm build              # Compile TypeScript
pnpm start              # Run compiled CLI
pnpm test               # Run tests with Vitest
pnpm test:coverage      # Generate coverage report
pnpm test:ui            # Launch Vitest UI
pnpm lint               # ESLint check
pnpm lint:fix           # ESLint fix
pnpm format             # Prettier format
```

### Testing Locally

```bash
pnpm build
pnpm link --global
gwm --help              # Test the CLI
```

### Architecture

- **Entry Point**: `src/index.tsx` - Command routing and argument parsing
- **Components**: `src/components/` - React components for each command's UI
- **Utilities**: `src/utils/` - Git operations, CLI parsing, formatting helpers
- **Types**: `src/types/` - TypeScript type definitions
- **Config**: `src/config.ts` - Configuration file handling
- **Tests**: `test/` - Unit tests for utilities and components

## Contributing

1. Fork the repository
2. Add your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- Built with [Ink](https://github.com/vadimdemedes/ink) for React-based CLI interfaces
- Inspired by modern Git workflow tools and `fzf`'s user experience
