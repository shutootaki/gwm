import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render } from 'ink-testing-library';
import { WorktreeSelector } from '../../src/components/WorktreeSelector.js';
import * as gitUtils from '../../src/utils/git.js';
import { Worktree } from '../../src/utils/index.js';

vi.mock('../../src/utils/git.js');

describe('WorktreeSelector', () => {
  const mockWorktrees: Worktree[] = [
    {
      path: '/path/to/worktree1',
      branch: 'main',
      sha: 'abc123',
      isActive: false,
      isMain: true,
      status: 'MAIN',
    },
    {
      path: '/path/to/worktree2',
      branch: 'feature-branch',
      sha: 'def456',
      isActive: true,
      isMain: false,
      status: 'OTHER',
    },
    {
      path: '/path/to/worktree3',
      branch: 'fix-bug',
      sha: 'ghi789',
      isActive: false,
      isMain: false,
      status: 'OTHER',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(gitUtils.getWorktreesWithStatus).mockResolvedValue(mockWorktrees);
  });

  it('should display legend with correct colors', async () => {
    const onSelect = vi.fn();
    const onCancel = vi.fn();

    const { lastFrame } = render(
      <WorktreeSelector
        onSelect={onSelect}
        onCancel={onCancel}
        placeholder="Select a worktree:"
      />
    );

    // Wait for async loading
    await vi.waitFor(() => {
      expect(lastFrame()).toBeTruthy();
    });

    const output = lastFrame();

    // Check if legend is displayed
    expect(output).toContain('[*] Active');
    expect(output).toContain('[M] Main');
    expect(output).toContain('[-] Other');
  });

  it('should display worktrees with correct prefixes', async () => {
    const onSelect = vi.fn();
    const onCancel = vi.fn();

    const { lastFrame } = render(
      <WorktreeSelector
        onSelect={onSelect}
        onCancel={onCancel}
        placeholder="Select a worktree:"
      />
    );

    // Wait for async loading
    await vi.waitFor(() => {
      expect(lastFrame()).toBeTruthy();
    });

    const output = lastFrame();

    // Check if worktrees are displayed with correct prefixes
    expect(output).toContain('[M] main');
    expect(output).toContain('[*] feature-branch');
    expect(output).toContain('[-] fix-bug');
  });
});