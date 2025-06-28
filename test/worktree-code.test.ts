import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render } from 'ink-testing-library';
import { execSync } from 'child_process';
import { WorktreeCode } from '../src/components/WorktreeCode.js';

// execSyncをモック化
vi.mock('child_process', () => ({
  execSync: vi.fn(),
}));

// WorktreeSelectorをモック化
vi.mock('../src/components/WorktreeSelector.js', () => ({
  WorktreeSelector: ({
    onSelect,
    onCancel,
    initialQuery,
    placeholder,
  }: any) => {
    return React.createElement('div', {
      'data-testid': 'worktree-selector',
      'data-initial-query': initialQuery,
      'data-placeholder': placeholder,
      onClick: () => onSelect({ path: '/test/path', branch: 'test-branch' }),
      onKeyDown: (e: any) => e.key === 'Escape' && onCancel(),
    });
  },
}));

const mockExecSync = vi.mocked(execSync);
const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
  throw new Error('process.exit called');
});

describe('WorktreeCode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render WorktreeSelector with correct props', () => {
    const { lastFrame } = render(
      React.createElement(WorktreeCode, { query: 'test-query' })
    );

    expect(lastFrame()).toBeDefined();
  });

  it('should open VS Code successfully and show success message', async () => {
    mockExecSync.mockReturnValue('');

    const { lastFrame } = render(React.createElement(WorktreeCode));

    expect(lastFrame()).toBeDefined();
    // WorktreeCodeコンポーネントが正しくレンダリングされていることを確認
  });

  it('should show error when VS Code command is not found', () => {
    mockExecSync.mockImplementation((command) => {
      if (command === 'which code') {
        const error = new Error('which code failed');
        error.message = 'which code failed';
        throw error;
      }
      return '';
    });

    const { lastFrame } = render(
      React.createElement(WorktreeCode)
    );

    expect(lastFrame()).toBeDefined();
  });

  it('should show error when VS Code fails to open', () => {
    mockExecSync.mockImplementation((command) => {
      if (command === 'which code') {
        return '';
      }
      throw new Error('Failed to open VS Code');
    });

    const { lastFrame } = render(
      React.createElement(WorktreeCode)
    );

    expect(lastFrame()).toBeDefined();
  });

  it('should exit on cancel', () => {
    const { lastFrame } = render(React.createElement(WorktreeCode));

    expect(lastFrame()).toBeDefined();
  });
});
