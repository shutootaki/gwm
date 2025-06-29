import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render } from 'ink-testing-library';

// --------------------
// Mock config to set WORKTREE_BASE_PATH
// --------------------
vi.mock('../src/config.js', () => ({
  loadConfig: () => ({
    worktree_base_path: '/Users/test/git-worktrees',
    main_branches: [],
    clean_branch: 'ask',
  }),
}));

// Mock terminal width hook so that column calculation is deterministic
vi.mock('../src/hooks/useTerminalWidth.js', () => ({
  useTerminalWidth: () => 120,
}));

// After mocks, import target components
import { WorktreeRow } from '../src/components/WorktreeRow.js';
import { WorktreeTable } from '../src/components/WorktreeTable.js';

// Utilities
const SAMPLE_BASE = '/Users/test/git-worktrees';
const SAMPLE_REPO_ROOT = '/Users/test/git-worktrees/project';

const sampleWorktree = {
  path: `${SAMPLE_BASE}/project/feature-a`,
  head: 'abcdef1234567890',
  branch: 'feature-a',
  status: 'OTHER',
  isActive: false,
  isMain: false,
};

describe('Base path token display', () => {
  it('WorktreeRow should prefix path with ${B}/ when under base path', () => {
    const { lastFrame } = render(
      React.createElement(WorktreeRow, {
        worktree: sampleWorktree,
        repoRoot: SAMPLE_REPO_ROOT,
        columnWidths: { branchWidth: 20, pathWidth: 60 },
      })
    );

    expect(lastFrame()).toContain('${B}/project/feature-a');
  });

  it('WorktreeTable should render legend for base path token', () => {
    const { lastFrame } = render(
      React.createElement(WorktreeTable, { worktrees: [sampleWorktree] })
    );

    expect(lastFrame()).toContain('${B} = /Users/test/git-worktrees');
  });
});
