# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

`wtm` (worktree manager) is a CLI tool designed to streamline Git worktree management with an interactive, React-based terminal UI. The project is currently in the specification phase with detailed requirements defined but no implementation yet.

## Project Structure

This is a TypeScript-based CLI tool with the following planned architecture:

- **Language**: TypeScript for type safety and development experience
- **UI Framework**: React for declarative UI components
- **CLI Library**: Ink for React-based terminal interfaces
- **Package Manager**: pnpm
- **Configuration**: TOML format (`~/.config/wtm/config.toml`)

## Core Commands (Planned)

### Development Commands

- `pnpm init` - Initialize project with package.json
- `pnpm add typescript ink react @types/react` - Install core dependencies
- `pnpm link --global` - Register wtm command locally for testing
- `pnpm add -D eslint prettier` - Add code quality tools

### Main CLI Commands (Specification)

- `wtm list` (alias: `ls`) - Display worktree list with status indicators
- `wtm create [branch_name]` - Create new worktree interactively or from specified branch
- `wtm remove [query]` (alias: `rm`) - Remove worktree(s) with fuzzy search selection
- `wtm clean` - Clean up merged/deleted worktrees with optional `--yes` flag
- `wtm go [query]` - Output worktree path for shell integration (used with `wgo()` shell function)
- `wtm code [query]` - Open selected worktree in VS Code

## Key Features

### Interactive UI Priority

- Commands without arguments launch fuzzy search interfaces
- Multi-select capabilities for operations like remove and clean
- fzf-like incremental search functionality

### Worktree Path Convention

- Default: `~/worktrees/<repository-name>/<branch-name>`
- Branch name normalization: `feature/user-auth` → `feature-user-auth`
- Configurable base path via config file

### Status Indicators

- `ACTIVE`: Current worktree (marked with `*`)
- `NORMAL`: Standard worktree
- `PRUNABLE`: Merged or deleted branches (candidates for cleanup)
- `LOCKED`: Git-locked worktrees

## Development Phases

The project follows a 5-phase development plan:

1. **Foundation**: Project setup, TypeScript config, basic Ink "Hello World"
2. **Read-only Features**: `wtm list` implementation, config file handling
3. **Core Operations**: Interactive UI components, create/remove/go/code commands
4. **Automation**: `wtm clean` command with merge detection
5. **Distribution**: Error handling, documentation, npm publishing

## Configuration

Settings file: `~/.config/wtm/config.toml`

```toml
worktree_base_path = "/Users/myuser/dev/worktrees"
main_branches = ["main", "master", "develop"]
```

## Shell Integration

The `wtm go` command is designed to work with a shell function:

```shell
# ~/.zshrc or ~/.bashrc
function wgo() {
  local path
  path="$(wtm go "$1")"
  if [ -n "$path" ]; then
    cd "$path"
  fi
}
```

## Technical Dependencies

Required packages (to be installed):

- `typescript` - Core language
- `ink` - React-based CLI framework
- `react` - UI framework
- `@types/react` - TypeScript definitions
- `@ltd/j-toml` - TOML configuration parser
- `ink-select-input` or similar - Interactive selection components

Development tools:

- `eslint`, `prettier` - Code quality
- `vitest` or `jest` - Testing framework (optional)

## Git Command Integration

The tool wraps several Git commands:

- `git worktree list --porcelain` - Machine-readable worktree listing
- `git worktree add` - Create new worktrees
- `git worktree remove` - Remove worktrees
- `git fetch --prune origin` - Update remote branch status
- `git branch -r` - List remote branches

## Current Status

- **Specification**: Complete with detailed command behaviors
- **Development Plan**: 5-phase roadmap defined
- **Implementation**: Not started - ready for initial project setup
