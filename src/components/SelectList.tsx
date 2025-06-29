import React, { useEffect, useMemo, useCallback, useReducer } from 'react';
import { Text, Box, useInput } from 'ink';
import { SelectItem } from '../types/common.js';
import { useEditableText } from '../hooks/useEditableText.js';

interface SelectListProps {
  items: SelectItem[];
  onSelect: (item: SelectItem) => void;
  onCancel: () => void;
  placeholder?: string;
  initialQuery?: string;
  maxDisplayItems?: number;
  title?: string;
  showStats?: boolean;
}

export const SelectList: React.FC<SelectListProps> = ({
  items,
  onSelect,
  onCancel,
  placeholder = 'Type to search...',
  initialQuery = '',
  maxDisplayItems = 15,
  title = 'Select',
  showStats = true,
}) => {
  const { value: query, cursorPosition } = useEditableText({
    initialValue: initialQuery,
  });

  /*
   * selectedIndex と scrollOffset をまとめて 1 つの useReducer で管理することで、
   * ↑/↓ キー押下時の setState 呼び出し回数を 1 回に抑え、
   * レンダリング回数を最小限にする。
   */

  interface ListState {
    selectedIndex: number;
    scrollOffset: number;
  }

  type Action =
    | { type: 'RESET' }
    | {
        type: 'MOVE';
        delta: number;
        listLength: number;
        maxDisplayItems: number;
      };

  const listReducer = (state: ListState, action: Action): ListState => {
    switch (action.type) {
      case 'RESET':
        return { selectedIndex: 0, scrollOffset: 0 };
      case 'MOVE': {
        if (action.listLength === 0) return state;

        let nextIndex = state.selectedIndex + action.delta;
        nextIndex = Math.max(0, Math.min(action.listLength - 1, nextIndex));

        // スクロール位置を調整してカーソルを可視範囲内へ
        let nextScrollOffset = state.scrollOffset;
        if (nextIndex < nextScrollOffset) {
          nextScrollOffset = nextIndex;
        } else if (nextIndex >= nextScrollOffset + action.maxDisplayItems) {
          nextScrollOffset = nextIndex - action.maxDisplayItems + 1;
        }

        // 変更がなければ同じオブジェクトを返して React の再レンダリングを防ぐ
        if (
          nextIndex === state.selectedIndex &&
          nextScrollOffset === state.scrollOffset
        ) {
          return state;
        }

        return { selectedIndex: nextIndex, scrollOffset: nextScrollOffset };
      }
      default:
        return state;
    }
  };

  const [{ selectedIndex, scrollOffset }, dispatch] = useReducer(listReducer, {
    selectedIndex: 0,
    scrollOffset: 0,
  });

  // フィルタリングされた項目をメモ化して無駄な再計算を防ぐ
  const filteredItems = useMemo(() => {
    const lower = query.toLowerCase();
    return items.filter((item) => item.label.toLowerCase().includes(lower));
  }, [items, query]);

  // 選択インデックスを範囲内に調整
  useEffect(() => {
    const maxIndex = Math.max(0, filteredItems.length - 1);
    if (selectedIndex > maxIndex) {
      dispatch({
        type: 'MOVE',
        delta: -1,
        listLength: filteredItems.length,
        maxDisplayItems,
      });
    }
  }, [filteredItems.length, selectedIndex, maxDisplayItems]);

  // スクロール位置を項目数の範囲内に収める
  useEffect(() => {
    const maxScroll = Math.max(0, filteredItems.length - maxDisplayItems);
    if (scrollOffset > maxScroll) {
      dispatch({
        type: 'MOVE',
        delta: -1,
        listLength: filteredItems.length,
        maxDisplayItems,
      });
    }
  }, [filteredItems.length, maxDisplayItems, scrollOffset]);

  // ↓/↑ で選択を移動する共通ロジック（useCallback でメモ化）
  const moveSelection = useCallback(
    (delta: number) => {
      dispatch({
        type: 'MOVE',
        delta,
        listLength: filteredItems.length,
        maxDisplayItems,
      });
    },
    [filteredItems.length, maxDisplayItems]
  );

  useInput((input, key) => {
    if (key.escape) {
      onCancel();
      return;
    }

    if (key.return) {
      if (filteredItems.length > 0) {
        onSelect(filteredItems[selectedIndex]);
      }
      return;
    }

    if (key.upArrow || (key.ctrl && input === 'p')) {
      moveSelection(-1);
      return;
    }

    if (key.downArrow || (key.ctrl && input === 'n')) {
      moveSelection(1);
      return;
    }
  });

  const currentItem = filteredItems[selectedIndex];
  const hasSelection = filteredItems.length > 0;

  // 可視アイテム計算（メモ化）
  const { visibleItems, hiddenAbove, hiddenBelow } = useMemo(() => {
    const vis = filteredItems.slice(
      scrollOffset,
      scrollOffset + maxDisplayItems
    );
    const above = scrollOffset;
    const below = Math.max(
      0,
      filteredItems.length - (scrollOffset + vis.length)
    );
    return { visibleItems: vis, hiddenAbove: above, hiddenBelow: below };
  }, [filteredItems, scrollOffset, maxDisplayItems]);

  return (
    <Box flexDirection="column">
      {/* Title */}
      <Box marginBottom={1}>
        <Text color="cyan" bold>
          {title}
        </Text>
      </Box>

      {/* Stats */}
      {showStats && (
        <Box marginBottom={1}>
          <Text color="gray">
            {filteredItems.length} / {items.length} items
            {hasSelection && (
              <>
                {' '}
                • {selectedIndex + 1} of {filteredItems.length}
              </>
            )}
          </Text>
        </Box>
      )}

      {/* Search Input */}
      <Box marginBottom={1}>
        <Box flexDirection="column">
          <Text color="gray">{placeholder}</Text>
          <Box marginTop={0}>
            <Text color="cyan" bold>
              ❯{' '}
            </Text>
            <Text>{query.slice(0, cursorPosition)}</Text>
            <Text color="cyan">█</Text>
            <Text>{query.slice(cursorPosition)}</Text>
          </Box>
        </Box>
      </Box>

      {/* Results */}
      <Box marginBottom={1}>
        {filteredItems.length === 0 ? (
          <Box flexDirection="column">
            <Text color="red">No matches found</Text>
          </Box>
        ) : (
          <Box flexDirection="column">
            {/* 上に隠れた要素数表示 */}
            {hiddenAbove > 0 && (
              <Box>
                <Text color="yellow">↑ {hiddenAbove} more</Text>
              </Box>
            )}

            {visibleItems.map((item, index) => {
              const globalIndex = scrollOffset + index;
              const isSelected = globalIndex === selectedIndex;
              return (
                <Box key={item.value}>
                  <Text color={isSelected ? 'cyan' : 'white'}>
                    {isSelected ? '▶ ' : '  '}
                    <Text
                      color={isSelected ? 'cyan' : 'white'}
                      bold={isSelected}
                    >
                      {item.label}
                    </Text>
                  </Text>
                </Box>
              );
            })}

            {hiddenBelow > 0 && (
              <Box>
                <Text color="yellow">↓ {hiddenBelow} more</Text>
              </Box>
            )}
          </Box>
        )}
      </Box>

      {/* Preview */}
      {hasSelection && currentItem && (
        <Box marginBottom={1}>
          <Box
            flexDirection="column"
            borderStyle="single"
            borderColor="gray"
            padding={1}
          >
            <Text color="yellow" bold>
              Preview
            </Text>
            <Text color="white">
              <Text color="cyan" bold>
                {currentItem.label}
              </Text>
            </Text>
            {currentItem.value !== currentItem.label && (
              <Text color="gray">Value: {currentItem.value}</Text>
            )}
          </Box>
        </Box>
      )}

      {/* Help */}
      <Box>
        <Text color="gray">
          <Text color="cyan">↑/↓</Text> navigate •{' '}
          <Text color="green">Enter</Text> select • <Text color="red">Esc</Text>{' '}
          cancel
        </Text>
      </Box>
    </Box>
  );
};
