import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render } from 'ink-testing-library';
import { WorktreeGo } from '../src/components/WorktreeGo.js';

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

// process.exitをモック化
const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
  throw new Error('process.exit called');
});

// console.logをモック化
const mockConsoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});

describe('WorktreeGo', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render WorktreeSelector with correct props', () => {
    const { getByTestId } = render(
      React.createElement(WorktreeGo, { query: 'test-query' })
    );

    const selector = getByTestId('worktree-selector');
    expect(selector).toBeDefined();
    expect(selector.getAttribute('data-initial-query')).toBe('test-query');
    expect(selector.getAttribute('data-placeholder')).toBe(
      'Select a worktree to go to:'
    );
  });

  it('should render WorktreeSelector without query', () => {
    const { getByTestId } = render(React.createElement(WorktreeGo));

    const selector = getByTestId('worktree-selector');
    expect(selector).toBeDefined();
    expect(selector.getAttribute('data-initial-query')).toBe('undefined');
  });

  it('should output path and exit on worktree selection', () => {
    const { getByTestId } = render(React.createElement(WorktreeGo));

    const selector = getByTestId('worktree-selector');

    expect(() => {
      selector.click();
    }).toThrow('process.exit called');

    expect(mockConsoleLog).toHaveBeenCalledWith('/test/path');
    expect(mockExit).toHaveBeenCalledWith(0);
  });

  it('should exit without output on cancel', () => {
    const { getByTestId } = render(React.createElement(WorktreeGo));

    const selector = getByTestId('worktree-selector');

    expect(() => {
      selector.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    }).toThrow('process.exit called');

    expect(mockConsoleLog).not.toHaveBeenCalled();
    expect(mockExit).toHaveBeenCalledWith(0);
  });
});
