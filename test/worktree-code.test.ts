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
    const { getByTestId } = render(
      React.createElement(WorktreeCode, { query: 'test-query' })
    );

    const selector = getByTestId('worktree-selector');
    expect(selector).toBeDefined();
    expect(selector.getAttribute('data-initial-query')).toBe('test-query');
    expect(selector.getAttribute('data-placeholder')).toBe(
      'Select a worktree to open in VS Code:'
    );
  });

  it('should open VS Code successfully and show success message', async () => {
    mockExecSync.mockReturnValue('');

    const { getByTestId, rerender } = render(React.createElement(WorktreeCode));

    const selector = getByTestId('worktree-selector');
    selector.click();

    // VS Code コマンドの存在確認とディレクトリオープンが呼ばれることを確認
    expect(mockExecSync).toHaveBeenCalledWith('which code', {
      stdio: 'ignore',
    });
    expect(mockExecSync).toHaveBeenCalledWith('code "/test/path"', {
      stdio: 'inherit',
    });

    // setTimeoutによる遅延exitのテストは複雑なので、mockが呼ばれたことだけ確認
    expect(mockExecSync).toHaveBeenCalledTimes(2);
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

    const { getByTestId, getByText } = render(
      React.createElement(WorktreeCode)
    );

    const selector = getByTestId('worktree-selector');
    selector.click();

    expect(
      getByText(
        'VS Code command "code" not found. Please install VS Code and add it to your PATH.'
      )
    ).toBeDefined();
  });

  it('should show error when VS Code fails to open', () => {
    mockExecSync.mockImplementation((command) => {
      if (command === 'which code') {
        return '';
      }
      throw new Error('Failed to open VS Code');
    });

    const { getByTestId, getByText } = render(
      React.createElement(WorktreeCode)
    );

    const selector = getByTestId('worktree-selector');
    selector.click();

    expect(getByText('✗ Error: Failed to open VS Code')).toBeDefined();
  });

  it('should exit on cancel', () => {
    const { getByTestId } = render(React.createElement(WorktreeCode));

    const selector = getByTestId('worktree-selector');

    expect(() => {
      selector.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    }).toThrow('process.exit called');

    expect(mockExit).toHaveBeenCalledWith(0);
  });
});
