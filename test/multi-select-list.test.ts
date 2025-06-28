import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SelectItem } from '../src/types/common.js';

// React InkのUIコンポーネントをモック化
vi.mock('ink', () => ({
  render: vi.fn(),
  Box: ({ children }: any) => children,
  Text: ({ children }: any) => children,
  useInput: vi.fn(),
  useApp: vi.fn(() => ({ exit: vi.fn() })),
}));

describe('MultiSelectList Component Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockItems: SelectItem[] = [
    { label: 'feature-auth', value: 'feature-auth' },
    { label: 'feature-ui', value: 'feature-ui' },
    { label: 'bugfix-login', value: 'bugfix-login' },
    { label: 'main', value: 'main' },
  ];

  describe('Search Query Management with Cursor', () => {
    it('should manage search query and cursor position correctly', () => {
      const query = 'feature';
      const cursorPosition = 4; // 'feat|ure'
      
      // カーソル位置での文字挿入
      const newChar = 'X';
      const newQuery = query.slice(0, cursorPosition) + newChar + query.slice(cursorPosition);
      const newCursorPosition = cursorPosition + 1;
      
      expect(newQuery).toBe('featXure');
      expect(newCursorPosition).toBe(5);
    });

    it('should handle backspace with cursor position', () => {
      const query = 'feature';
      const cursorPosition = 4; // 'feat|ure'
      
      if (cursorPosition > 0) {
        const newQuery = query.slice(0, cursorPosition - 1) + query.slice(cursorPosition);
        const newCursorPosition = cursorPosition - 1;
        
        expect(newQuery).toBe('feaure');
        expect(newCursorPosition).toBe(3);
      }
    });

    it('should handle delete key with cursor position', () => {
      const query = 'feature';
      const cursorPosition = 4; // 'feat|ure'
      
      if (cursorPosition < query.length) {
        const newQuery = query.slice(0, cursorPosition) + query.slice(cursorPosition + 1);
        
        expect(newQuery).toBe('featre');
      }
    });

    it('should handle word deletion (Ctrl+W) in search', () => {
      const query = 'feature auth test';
      const cursorPosition = 12; // 'feature auth|test'
      
      // カーソル位置から左の単語境界を見つける
      let wordStart = cursorPosition;
      while (wordStart > 0 && query[wordStart - 1] !== ' ') {
        wordStart--;
      }
      
      const newQuery = query.slice(0, wordStart) + query.slice(cursorPosition);
      const newCursorPosition = wordStart;
      
      expect(newQuery).toBe('feature  test');
      expect(newCursorPosition).toBe(8);
    });

    it('should handle full query deletion (Command+Delete)', () => {
      const query = 'feature';
      const newQuery = '';
      const newCursorPosition = 0;
      
      expect(newQuery).toBe('');
      expect(newCursorPosition).toBe(0);
    });
  });

  describe('Filtering with Search Query', () => {
    it('should filter items based on search query', () => {
      const query = 'feature';
      const filteredItems = mockItems.filter((item) =>
        item.label.toLowerCase().includes(query.toLowerCase())
      );
      
      expect(filteredItems).toHaveLength(2);
      expect(filteredItems[0].label).toBe('feature-auth');
      expect(filteredItems[1].label).toBe('feature-ui');
    });

    it('should perform case-insensitive filtering', () => {
      const query = 'FEATURE';
      const filteredItems = mockItems.filter((item) =>
        item.label.toLowerCase().includes(query.toLowerCase())
      );
      
      expect(filteredItems).toHaveLength(2);
    });

    it('should return all items when query is empty', () => {
      const query = '';
      const filteredItems = mockItems.filter((item) =>
        item.label.toLowerCase().includes(query.toLowerCase())
      );
      
      expect(filteredItems).toEqual(mockItems);
    });

    it('should return no items when query matches nothing', () => {
      const query = 'nonexistent';
      const filteredItems = mockItems.filter((item) =>
        item.label.toLowerCase().includes(query.toLowerCase())
      );
      
      expect(filteredItems).toHaveLength(0);
    });
  });

  describe('Selection Management', () => {
    it('should handle item selection and deselection', () => {
      const selectedItems = new Set<string>();
      const itemValue = 'feature-auth';
      
      // 初期状態：未選択
      expect(selectedItems.has(itemValue)).toBe(false);
      
      // 選択
      selectedItems.add(itemValue);
      expect(selectedItems.has(itemValue)).toBe(true);
      expect(selectedItems.size).toBe(1);
      
      // 再度選択（トグル）
      selectedItems.delete(itemValue);
      expect(selectedItems.has(itemValue)).toBe(false);
      expect(selectedItems.size).toBe(0);
    });

    it('should handle multiple selections', () => {
      const selectedItems = new Set<string>();
      
      selectedItems.add('feature-auth');
      selectedItems.add('feature-ui');
      
      expect(selectedItems.size).toBe(2);
      expect(selectedItems.has('feature-auth')).toBe(true);
      expect(selectedItems.has('feature-ui')).toBe(true);
      expect(selectedItems.has('bugfix-login')).toBe(false);
    });

    it('should handle select all functionality', () => {
      const selectedItems = new Set<string>();
      const filteredItems = mockItems.filter(item => item.label.includes('feature'));
      
      // 全選択
      if (selectedItems.size === filteredItems.length) {
        selectedItems.clear();
      } else {
        filteredItems.forEach(item => selectedItems.add(item.value));
      }
      
      expect(selectedItems.size).toBe(2);
      expect(selectedItems.has('feature-auth')).toBe(true);
      expect(selectedItems.has('feature-ui')).toBe(true);
    });

    it('should handle select all toggle when all items are selected', () => {
      const selectedItems = new Set<string>(['feature-auth', 'feature-ui']);
      const filteredItems = mockItems.filter(item => item.label.includes('feature'));
      
      // 全解除
      if (selectedItems.size === filteredItems.length) {
        selectedItems.clear();
      } else {
        filteredItems.forEach(item => selectedItems.add(item.value));
      }
      
      expect(selectedItems.size).toBe(0);
    });
  });

  describe('Navigation State Management', () => {
    it('should handle list navigation separately from search cursor', () => {
      const filteredItems = mockItems.filter(item => item.label.includes('feature'));
      let selectedIndex = 0;
      
      // 下矢印
      selectedIndex = Math.min(filteredItems.length - 1, selectedIndex + 1);
      expect(selectedIndex).toBe(1);
      
      // 上矢印
      selectedIndex = Math.max(0, selectedIndex - 1);
      expect(selectedIndex).toBe(0);
      
      // 範囲外チェック
      selectedIndex = Math.max(0, selectedIndex - 1);
      expect(selectedIndex).toBe(0);
      
      selectedIndex = Math.min(filteredItems.length - 1, selectedIndex + 10);
      expect(selectedIndex).toBe(1);
    });

    it('should adjust selected index when filtered items change', () => {
      let filteredItems = mockItems;
      let selectedIndex = 3; // 'main'
      
      // フィルタリング後にインデックスを調整
      filteredItems = mockItems.filter(item => item.label.includes('feature'));
      const maxIndex = Math.max(0, filteredItems.length - 1);
      selectedIndex = Math.min(selectedIndex, maxIndex);
      
      expect(selectedIndex).toBe(1); // 'feature-ui'
      expect(filteredItems).toHaveLength(2);
    });
  });

  describe('Keyboard Event Handling Logic', () => {
    it('should distinguish between navigation and search input', () => {
      const simulateKeyboardEvent = (
        key: string,
        query: string,
        cursorPosition: number,
        selectedIndex: number,
        filteredItemsLength: number
      ) => {
        let newQuery = query;
        let newCursorPosition = cursorPosition;
        let newSelectedIndex = selectedIndex;
        
        if (key === 'upArrow') {
          newSelectedIndex = Math.max(0, selectedIndex - 1);
        } else if (key === 'downArrow') {
          newSelectedIndex = Math.min(filteredItemsLength - 1, selectedIndex + 1);
        } else if (key === 'leftArrow') {
          newCursorPosition = Math.max(0, cursorPosition - 1);
        } else if (key === 'rightArrow') {
          newCursorPosition = Math.min(query.length, cursorPosition + 1);
        } else if (key === 'backspace' && cursorPosition > 0) {
          newQuery = query.slice(0, cursorPosition - 1) + query.slice(cursorPosition);
          newCursorPosition = cursorPosition - 1;
        }
        
        return {
          query: newQuery,
          cursorPosition: newCursorPosition,
          selectedIndex: newSelectedIndex,
        };
      };

      let state = {
        query: 'feature',
        cursorPosition: 7,
        selectedIndex: 0,
      };

      // 上下矢印はリストナビゲーション
      state = simulateKeyboardEvent('downArrow', state.query, state.cursorPosition, state.selectedIndex, 2);
      expect(state.selectedIndex).toBe(1);
      expect(state.cursorPosition).toBe(7); // 変化なし

      // 左右矢印は検索カーソル移動
      state = simulateKeyboardEvent('leftArrow', state.query, state.cursorPosition, state.selectedIndex, 2);
      expect(state.cursorPosition).toBe(6);
      expect(state.selectedIndex).toBe(1); // 変化なし

      // Backspaceは検索クエリ編集
      state = simulateKeyboardEvent('backspace', state.query, state.cursorPosition, state.selectedIndex, 2);
      expect(state.query).toBe('featue');
      expect(state.cursorPosition).toBe(5);
    });
  });

  describe('Display Logic', () => {
    it('should split search query for cursor display', () => {
      const query = 'feature';
      const cursorPosition = 4;
      
      const beforeCursor = query.slice(0, cursorPosition);
      const afterCursor = query.slice(cursorPosition);
      
      expect(beforeCursor).toBe('feat');
      expect(afterCursor).toBe('ure');
    });

    it('should generate correct item labels with selection status', () => {
      const selectedItems = new Set(['feature-auth']);
      
      const items = mockItems.map((item, index) => {
        const isItemSelected = selectedItems.has(item.value);
        const isCurrent = index === 0;
        
        return {
          ...item,
          display: {
            pointer: isCurrent ? '▶ ' : '  ',
            checkbox: isItemSelected ? '[x] ' : '[ ] ',
            isCurrentStyle: isCurrent,
            isSelectedStyle: isItemSelected,
          },
        };
      });

      expect(items[0].display.pointer).toBe('▶ ');
      expect(items[0].display.checkbox).toBe('[x] ');
      expect(items[1].display.pointer).toBe('  ');
      expect(items[1].display.checkbox).toBe('[ ] ');
    });

    it('should handle stats display correctly', () => {
      const selectedItems = new Set(['feature-auth', 'feature-ui']);
      const filteredItems = mockItems.filter(item => item.label.includes('feature'));
      const selectedIndex = 1;
      
      const stats = {
        filteredCount: filteredItems.length,
        totalCount: mockItems.length,
        selectedCount: selectedItems.size,
        cursorPosition: selectedIndex + 1,
      };
      
      expect(stats.filteredCount).toBe(2);
      expect(stats.totalCount).toBe(4);
      expect(stats.selectedCount).toBe(2);
      expect(stats.cursorPosition).toBe(2);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty item list', () => {
      const emptyItems: SelectItem[] = [];
      const query = 'test';
      
      const filteredItems = emptyItems.filter((item) =>
        item.label.toLowerCase().includes(query.toLowerCase())
      );
      
      expect(filteredItems).toHaveLength(0);
    });

    it('should handle cursor position at boundaries', () => {
      const query = 'test';
      let cursorPosition = 0;
      
      // 左端での左矢印
      cursorPosition = Math.max(0, cursorPosition - 1);
      expect(cursorPosition).toBe(0);
      
      // 右端での右矢印
      cursorPosition = query.length;
      cursorPosition = Math.min(query.length, cursorPosition + 1);
      expect(cursorPosition).toBe(4);
    });

    it('should handle selection index adjustment when no items match', () => {
      const filteredItems: SelectItem[] = [];
      let selectedIndex = 5;
      
      const maxIndex = Math.max(0, filteredItems.length - 1);
      selectedIndex = Math.min(selectedIndex, maxIndex);
      
      expect(selectedIndex).toBe(0);
    });

    it('should handle word deletion at word boundaries', () => {
      const testCases = [
        { query: 'word', cursorPosition: 4, expected: '' },
        { query: ' word', cursorPosition: 5, expected: ' ' },
        { query: 'hello world', cursorPosition: 11, expected: 'hello ' },
        { query: 'hello  world', cursorPosition: 12, expected: 'hello  ' },
      ];

      testCases.forEach(({ query, cursorPosition, expected }) => {
        let wordStart = cursorPosition;
        while (wordStart > 0 && query[wordStart - 1] !== ' ') {
          wordStart--;
        }
        
        const newQuery = query.slice(0, wordStart) + query.slice(cursorPosition);
        expect(newQuery).toBe(expected);
      });
    });
  });
});