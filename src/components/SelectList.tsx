import React, { useEffect, useState } from 'react';
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
  const {
    value: query,
    setValue: setQuery,
    cursorPosition,
  } = useEditableText({ initialValue: initialQuery });

  const [selectedIndex, setSelectedIndex] = useState(0);
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

    // スクロール位置を調整してカーソルを可視範囲内へ
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

    // Ctrl+U: クエリ消去 & スクロール位置リセット
    if (key.ctrl && input === 'u') {
      setQuery('');
      setScrollOffset(0);
      return;
    }
  });

  const currentItem = filteredItems[selectedIndex];
  const hasSelection = filteredItems.length > 0;

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
            {query && (
              <Text color="gray">
                Press <Text color="cyan">Ctrl+U</Text> to clear search
              </Text>
            )}
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
          cancel • <Text color="yellow">Ctrl+U</Text> clear
        </Text>
      </Box>
    </Box>
  );
};
