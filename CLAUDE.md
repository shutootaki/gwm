# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

`gwm` (worktree manager) is a TypeScript CLI tool for Git worktree management with an interactive React-based terminal UI built with Ink. The project is actively implemented with core functionality completed.

## Project Structure

- **Language**: TypeScript with ES modules
- **UI Framework**: React with Ink for terminal interfaces
- **Testing**: Vitest for unit testing
- **Package Manager**: pnpm
- **Configuration**: TOML format (`~/.config/gwm/config.toml`)

## Development Commands

- `pnpm build` - Compile TypeScript to dist/
- `pnpm dev` - Watch mode compilation
- `pnpm start` - Run compiled CLI tool
- `pnpm test` - Run tests with Vitest
- `pnpm test:run` - Run tests once
- `pnpm test:ui` - Launch Vitest UI
- `pnpm test:coverage` - Generate coverage report
- `pnpm lint` - ESLint check
- `pnpm lint:fix` - ESLint fix
- `pnpm format` - Prettier format

## Architecture

The CLI follows a component-based architecture:

- `src/index.tsx` - Main entry point with command routing
- `src/components/` - React components for each command
- `src/utils/` - Core utilities (CLI parsing, Git operations, formatting)
- `src/types/` - TypeScript type definitions
- `src/config.ts` - Configuration management
- `test/` - Unit tests for all utilities and components

## Main CLI Commands

- `gwm list` (alias: `ls`) - Display worktree list with status indicators
- `gwm add [branch_name]` - Add new worktree interactively or from specified branch
- `gwm remove [query]` (alias: `rm`) - Remove worktree(s) with fuzzy search selection
- `gwm clean` - Currently disabled (PRUNABLE auto-detection removed)
- `gwm go [query]` - Output worktree path for shell integration (used with `wgo()` shell function)
- `gwm code [query]` - Open selected worktree in VS Code

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

- `ACTIVE`: Current worktree (marked with `*`, yellow)
- `MAIN`: Base main worktree (marked with `M`, cyan)
- `OTHER`: All other worktrees (marked with `-`, white)

## Development Phases

The project follows a 5-phase development plan:

1. **Foundation**: Project setup, TypeScript config, basic Ink "Hello World"
2. **Read-only Features**: `gwm list` implementation, config file handling
3. **Core Operations**: Interactive UI components, add/remove/go/code commands
4. **Automation**: ~~`gwm clean` command with merge detection~~ (simplified to 3-status system)
5. **Distribution**: Error handling, documentation, npm publishing

## Configuration

Settings file: `~/.config/gwm/config.toml`

```toml
worktree_base_path = "/Users/myuser/dev/worktrees"
main_branches = ["main", "master", "develop"]
```

## Shell Integration

The `gwm go` command is designed to work with a shell function:

```shell
# ~/.zshrc or ~/.bashrc
function wgo() {
  local path
  path="$(gwm go "$1")"
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
- `git worktree add` - Add new worktrees
- `git worktree remove` - Remove worktrees
- `git fetch --prune origin` - Update remote branch status
- `git branch -r` - List remote branches

## Testing

Tests are located in `test/` directory using Vitest:

- Run single test: `pnpm test <filename>`
- Watch mode: `pnpm test --watch`
- Coverage excludes UI components and main entry point

Note: Some test files reference `ink-testing-library` which needs to be installed for component testing.

## Current Implementation Status

- **Core Commands**: All main commands implemented with React components
- **Utilities**: Git operations, CLI parsing, configuration handling complete
- **Testing**: Comprehensive unit tests for utilities
- **Missing**: `ink-testing-library` dependency for UI component tests
