# gwm - Git Worktree Manager

A CLI tool for managing Git worktrees with an interactive TUI.

## Features

- **List worktrees** with status indicators (Active/Main/Other)
- **Add worktrees** with interactive branch input or remote selection
- **Remove worktrees** with multi-select interface and optional branch cleanup
- **Navigate** to worktrees with shell integration
- **Clean up** merged/deleted worktrees automatically
- **Update** main branch worktrees with one command
- **Secure hooks** with trust verification
- **Copy `.env` files** to new worktrees automatically

## Installation

### From crates.io

```bash
cargo install gwm
```

### From source

```bash
git clone https://github.com/shutootaki/gwm
cd gwm/gwm-rust
cargo install --path .
```

### Pre-built binaries

Download from the [Releases](https://github.com/shutootaki/gwm/releases) page.

## Quick Start

```bash
# List all worktrees
gwm list

# Add a new worktree (interactive)
gwm add

# Add a new worktree with branch name
gwm add feature/new-ui

# Add from remote branch
gwm add -r

# Remove worktrees (multi-select)
gwm remove

# Navigate to worktree
gwm go feature

# Clean up merged worktrees
gwm clean

# Update main branch worktrees
gwm pull-main
```

## Shell Integration

Add this function to your `~/.zshrc` or `~/.bashrc`:

```bash
wgo() {
    local path
    path="$(gwm go "$1")"
    if [ -n "$path" ]; then
        cd "$path"
    fi
}
```

Now you can navigate to worktrees with:

```bash
wgo feature  # Navigate to worktree matching "feature"
```

## Configuration

Create `~/.config/gwm/config.toml`:

```toml
# Base directory for worktrees
worktree_base_path = "~/git-worktrees"

# Main branches to track
main_branches = ["main", "master", "develop"]

# Branch cleanup mode: auto | ask | never
clean_branch = "ask"

# Copy .env files to new worktrees
[copy_ignored_files]
enabled = true
patterns = [".env", ".env.*"]
exclude_patterns = [".env.example", ".env.sample"]

# Post-create hooks
[hooks.post_create]
enabled = true
commands = ["npm install", "npm run build"]

# Virtual environment handling
[virtual_env_handling]
isolate_virtual_envs = true
```

## Commands

| Command         | Alias | Description                       |
| --------------- | ----- | --------------------------------- |
| `gwm list`      | `ls`  | List all worktrees                |
| `gwm add`       | -     | Add a new worktree                |
| `gwm remove`    | `rm`  | Remove worktree(s)                |
| `gwm go`        | -     | Navigate to a worktree            |
| `gwm clean`     | -     | Clean up merged/deleted worktrees |
| `gwm pull-main` | -     | Update main branch worktrees      |
| `gwm help`      | -     | Show help                         |

### `gwm list`

Display a table of all worktrees with their status.

**Status indicators:**

- `[*] ACTIVE` - Current worktree (yellow)
- `[M] MAIN` - Main branch worktree (cyan)
- `[-] OTHER` - Other worktrees (white)

### `gwm add`

Create a new worktree.

```bash
gwm add [OPTIONS] [BRANCH_NAME]

Options:
  -r, --remote           Select from remote branches
      --from <BRANCH>    Base branch for new worktree
      --code             Open in VS Code after creation
      --cursor           Open in Cursor after creation
      --cd               Output path only
      --skip-hooks       Skip post_create hooks
```

### `gwm remove`

Remove one or more worktrees.

```bash
gwm remove [OPTIONS] [QUERY]

Options:
  -f, --force                Force removal
      --clean-branch <MODE>  Branch cleanup mode (auto|ask|never)
```

### `gwm go`

Navigate to a worktree.

```bash
gwm go [OPTIONS] [QUERY]

Options:
      --code    Open in VS Code
      --cursor  Open in Cursor
```

### `gwm clean`

Clean up merged/deleted worktrees safely.

```bash
gwm clean [OPTIONS]

Options:
  -n, --dry-run  Show what would be cleaned
  -y, --force    Skip confirmation prompt
```

A worktree is considered cleanable if:

1. Remote branch has been deleted, OR local branch is merged into main
2. No uncommitted changes
3. No unpushed commits

### `gwm pull-main`

Update all main branch worktrees to latest.

```bash
gwm pull-main
```

## Worktree Path Convention

Worktrees are created at:

```
{worktree_base_path}/{repo_name}/{branch_name}
```

Branch names are sanitized: `feature/auth` becomes `feature-auth`

## Project Structure

```
src/
├── main.rs                    # Entry point
├── lib.rs                     # Library root
├── cli/
│   ├── mod.rs
│   └── args.rs                # CLI argument definitions
├── config/
│   ├── mod.rs
│   ├── types.rs               # Configuration types
│   ├── loader.rs              # Config loading
│   └── merger.rs              # Config merging
├── error.rs                   # Error types
├── git/
│   ├── mod.rs
│   ├── add.rs                 # Worktree creation
│   ├── clean.rs               # Cleanup detection
│   ├── core.rs                # Core Git operations
│   ├── pull.rs                # Git pull
│   ├── remote.rs              # Remote operations
│   ├── remove.rs              # Worktree removal
│   └── worktree.rs            # Worktree operations
├── hooks/
│   ├── mod.rs
│   └── runner.rs              # Hook execution
├── shell/
│   └── mod.rs                 # Shell command execution
├── trust/
│   ├── mod.rs
│   ├── cache.rs               # Trust cache
│   └── verifier.rs            # Trust verification
├── ui/
│   ├── mod.rs
│   ├── event.rs               # Event handling
│   ├── views/
│   │   ├── add.rs             # Add command UI
│   │   ├── clean.rs           # Clean command UI
│   │   ├── go.rs              # Go command UI
│   │   ├── help.rs            # Help command
│   │   ├── list.rs            # List command UI
│   │   ├── pull_main.rs       # Pull-main command UI
│   │   └── remove.rs          # Remove command UI
│   └── widgets/
│       ├── confirm.rs         # Confirmation dialog
│       ├── multi_select_list.rs  # Multi-select
│       ├── select_list.rs     # Single select
│       └── text_input.rs      # Text input
└── utils/
    ├── mod.rs
    ├── copy.rs                # File copying
    ├── editor.rs              # Editor integration
    ├── formatting.rs          # Output formatting
    ├── validation.rs          # Input validation
    └── virtualenv.rs          # Virtual env detection
```

## Development

```bash
# Build
cargo build

# Run tests
cargo test

# Run with verbose output
RUST_LOG=debug cargo run -- list

# Build release
cargo build --release

# Run clippy
cargo clippy

# Format code
cargo fmt
```

## License

MIT
