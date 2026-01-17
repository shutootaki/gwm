import React, { useEffect, useState } from 'react';
import { Text, Box, useInput } from 'ink';
import { SelectItem } from '../types/common.js';
import { useEditableText } from '../hooks/useEditableText.js';

interface MultiSelectListProps {
  items: SelectItem[];
  onConfirm: (selectedItems: SelectItem[]) => void;
  onCancel: () => void;
  placeholder?: string;
  initialQuery?: string;
  maxDisplayItems?: number;
  title?: string;
  showStats?: boolean;
}

export const MultiSelectList: React.FC<MultiSelectListProps> = ({
  items,
  onConfirm,
  onCancel,
  placeholder = 'Type to search, Space to select...',
  initialQuery = '',
  maxDisplayItems = 15,
  title = 'Multi-select',
  showStats = true,
}) => {
  const { value: query, cursorPosition } = useEditableText({
    initialValue: initialQuery,
    skipChars: [' '],
  });
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [scrollOffset, setScrollOffset] = useState(0);

  // フィルタリングされた項目
  const filteredItems = items.filter((item) =>
    item.label.toLowerCase().includes(query.toLowerCase())
  );

  // 選択インデックスを範囲内に調整
  useEffect(() => {
    const maxIndex = Math.max(0, filteredItems.length - 1);
    if (selectedIndex > maxIndex) {
      setSelectedIndex(maxIndex);
    }
  }, [filteredItems.length, selectedIndex]);

  // スクロール位置を項目数の範囲内に収める
  useEffect(() => {
    const maxScroll = Math.max(0, filteredItems.length - maxDisplayItems);
    if (scrollOffset > maxScroll) {
      setScrollOffset(Math.max(0, Math.min(maxScroll, selectedIndex)));
    }
  }, [filteredItems.length, maxDisplayItems, scrollOffset, selectedIndex]);

  // ↓/↑ で選択を移動する共通ロジック
  const moveSelection = (delta: number) => {
    if (filteredItems.length === 0) return;
    let nextIndex = selectedIndex + delta;
    nextIndex = Math.max(0, Math.min(filteredItems.length - 1, nextIndex));

    if (nextIndex < scrollOffset) {
      setScrollOffset(nextIndex);
    } else if (nextIndex >= scrollOffset + maxDisplayItems) {
      setScrollOffset(nextIndex - maxDisplayItems + 1);
    }

    setSelectedIndex(nextIndex);
  };

  useInput((input, key) => {
    if (key.escape) {
      onCancel();
      return;
    }

    if (key.return) {
      const selected = items.filter((item) => selectedItems.has(item.value));
      onConfirm(selected);
      return;
    }

    if (key.ctrl && input === 'a') {
      if (filteredItems.length > 0) {
        const newSelected = new Set(selectedItems);
        const allVisibleSelected = filteredItems.every((item) =>
          newSelected.has(item.value)
        );
        if (allVisibleSelected) {
          filteredItems.forEach((item) => newSelected.delete(item.value));
        } else {
          filteredItems.forEach((item) => newSelected.add(item.value));
        }
        setSelectedItems(newSelected);
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

    // Space: 現在行の選択トグル
    if (input === ' ') {
      const currentItem = filteredItems[selectedIndex];
      if (currentItem) {
        const newSelected = new Set(selectedItems);
        if (newSelected.has(currentItem.value)) {
          newSelected.delete(currentItem.value);
        } else {
          newSelected.add(currentItem.value);
        }
        setSelectedItems(newSelected);
      }
      return;
    }
  });

  const hasItems = filteredItems.length > 0;

  // 可視アイテム計算
  const visibleItems = filteredItems.slice(
    scrollOffset,
    scrollOffset + maxDisplayItems
  );
  const hiddenAbove = scrollOffset;
  const hiddenBelow = Math.max(
    0,
    filteredItems.length - (scrollOffset + visibleItems.length)
  );

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
            {hasItems && <> • cursor at {selectedIndex + 1}</>} •{' '}
            <Text color="green" bold>
              {selectedItems.size} selected
            </Text>
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
        {!hasItems ? (
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
              const isItemSelected = selectedItems.has(item.value);
              const isCurrent = globalIndex === selectedIndex;

              return (
                <Box key={item.value}>
                  <Text color={isCurrent ? 'cyan' : 'white'}>
                    {isCurrent ? '▶ ' : '  '}
                    {isItemSelected ? (
                      <Text color="green" bold>
                        [x]{' '}
                      </Text>
                    ) : (
                      <Text color="gray">[ ] </Text>
                    )}
                    <Text color={isCurrent ? 'cyan' : 'white'} bold={isCurrent}>
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

      {/* Selected Items Preview */}
      {selectedItems.size > 0 && (
        <Box marginBottom={1}>
          <Box
            flexDirection="column"
            borderStyle="single"
            borderColor="green"
            padding={1}
          >
            <Text color="green" bold>
              Selected ({selectedItems.size} items)
            </Text>
            <Box flexDirection="column">
              {Array.from(selectedItems)
                .slice(0, 5)
                .map((value) => {
                  const item = items.find((i) => i.value === value);
                  return item ? (
                    <Text key={value} color="gray">
                      • {item.label}
                    </Text>
                  ) : null;
                })}
              {selectedItems.size > 5 && (
                <Text color="gray">... {selectedItems.size - 5} more</Text>
              )}
            </Box>
          </Box>
        </Box>
      )}

      {/* Help */}
      <Box>
        <Box flexDirection="column">
          <Text color="gray">
            <Text color="cyan">↑/↓</Text> navigate •{' '}
            <Text color="yellow">Space</Text> toggle •{' '}
            <Text color="green">Enter</Text> confirm •{' '}
            <Text color="red">Esc</Text> cancel
          </Text>
          <Text color="gray">
            <Text color="cyan">Ctrl+A</Text> select all / clear all
          </Text>
        </Box>
      </Box>
    </Box>
  );
};
