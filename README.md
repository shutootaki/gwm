# wtm - Git Worktree Manager

A modern CLI tool for efficient Git worktree management with an interactive, React-based terminal UI.

## Features

- **Interactive UI**: fzf-like fuzzy search for all operations
- **Intuitive Commands**: Simple, single-purpose commands for worktree management
- **Smart Status Detection**: Automatically identifies merged and prunable worktrees
- **Shell Integration**: Seamless navigation with shell functions
- **VS Code Integration**: Open worktrees directly in your editor
- **Configurable**: Customize paths and behavior via TOML configuration

## Installation

### From npm (Coming Soon)

```bash
npm install -g wtm
```

### From Source

```bash
git clone https://github.com/your-username/wtm.git
cd wtm
pnpm install
pnpm build
pnpm link --global
```

## Commands

### `wtm list` (alias: `ls`)

Display all worktrees with their status, branch, path, and commit information.

```bash
wtm list
```

**Status Indicators:**
- `* ACTIVE`: Currently active worktree
- `NORMAL`: Standard worktree
- `PRUNABLE`: Merged or deleted branches (cleanup candidates)
- `LOCKED`: Git-locked worktrees

### `wtm create [branch]`

Create a new worktree from a branch. Without arguments, launches interactive branch selection.

```bash
# Interactive mode
wtm create

# Create from local branch
wtm create feature/new-ui

# Create from remote branch
wtm create -r origin/feature/api-update

# Create new branch from specific base
wtm create new-feature --from main
```

**Options:**
- `-r, --remote`: Create from remote branch
- `--from <branch>`: Specify base branch for new branch creation

### `wtm remove` (alias: `rm`)

Remove one or more worktrees with interactive multi-selection.

```bash
# Interactive selection
wtm remove

# Pre-filter with query
wtm remove feature

# Force removal
wtm remove -f
```

**Options:**
- `-f, --force`: Force removal even with uncommitted changes

### `wtm clean`

Clean up merged or deleted worktrees automatically.

```bash
# Interactive cleanup
wtm clean

# Auto-cleanup without confirmation
wtm clean -y
```

**Options:**
- `-y, --yes`: Skip confirmation prompts

### `wtm go [query]`

Navigate to a worktree directory. Designed for shell integration.

```bash
# Interactive selection
wtm go

# Pre-filter selection
wtm go feature
```

### `wtm code [query]`

Open a worktree in Visual Studio Code.

```bash
# Interactive selection
wtm code

# Pre-filter selection
wtm code feature
```

## Shell Integration

Add this function to your `~/.zshrc` or `~/.bashrc` for seamless navigation:

```bash
function wgo() {
  local path
  path="$(wtm go "$1")"
  if [ -n "$path" ]; then
    cd "$path"
  fi
}
```

Usage:
```bash
wgo feature  # Navigate to worktree matching "feature"
wgo          # Interactive selection
```

## Configuration

Create a configuration file at `~/.config/wtm/config.toml` or `~/.wtmrc`:

```toml
# Base directory for worktrees (default: ~/worktrees)
worktree_base_path = "/Users/myuser/dev/worktrees"

# Main branches for merge detection (default: ["main", "master", "develop"])
main_branches = ["main", "master", "develop"]
```

### Worktree Path Convention

Worktrees are created at: `<worktree_base_path>/<repository-name>/<branch-name>`

Branch names with slashes are normalized:
- `feature/user-auth` → `feature-user-auth`

## Examples

```bash
# List all worktrees
wtm list

# Create worktree from remote branch
wtm create -r origin/hotfix/critical-bug

# Interactive worktree removal
wtm remove

# Clean up merged branches
wtm clean

# Navigate to specific worktree
wgo api  # Using shell function

# Open worktree in VS Code
wtm code frontend
```

## Requirements

- Node.js 16+
- Git 2.25+
- VS Code (optional, for `wtm code` command)

## Development

```bash
# Clone and setup
git clone https://github.com/your-username/wtm.git
cd wtm
pnpm install

# Development mode
pnpm dev

# Build
pnpm build

# Test locally
pnpm link --global
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- Built with [Ink](https://github.com/vadimdemedes/ink) for React-based CLI interfaces
- Inspired by modern Git workflow tools and `fzf`'s user experience