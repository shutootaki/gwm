import React, { useState, useEffect } from 'react';
import { Text, Box, useInput } from 'ink';
import { SelectItem } from '../types/common.js';

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
  const [query, setQuery] = useState(initialQuery);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());

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

    if (key.upArrow || (key.ctrl && input === 'p')) {
      setSelectedIndex(Math.max(0, selectedIndex - 1));
      return;
    }

    if (key.downArrow || (key.ctrl && input === 'n')) {
      setSelectedIndex(Math.min(filteredItems.length - 1, selectedIndex + 1));
      return;
    }

    if (key.ctrl && input === 'u') {
      setQuery('');
      return;
    }

    if (key.ctrl && input === 'a') {
      // 全選択/全解除
      if (selectedItems.size === filteredItems.length) {
        setSelectedItems(new Set());
      } else {
        setSelectedItems(new Set(filteredItems.map((item) => item.value)));
      }
      return;
    }

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

    if (key.backspace || key.delete) {
      setQuery(query.slice(0, -1));
      return;
    }

    if (input && input.length === 1 && input !== ' ') {
      setQuery(query + input);
    }
  });

  const hasItems = filteredItems.length > 0;

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
            <Text>{query}</Text>
            <Text color="cyan">█</Text>
          </Box>
        </Box>
      </Box>

      {/* Results */}
      <Box marginBottom={1}>
        {!hasItems ? (
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
            {filteredItems.slice(0, maxDisplayItems).map((item, index) => {
              const isItemSelected = selectedItems.has(item.value);
              const isCurrent = index === selectedIndex;

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
            {filteredItems.length > maxDisplayItems && (
              <Box marginTop={1}>
                <Text color="yellow">
                  ... {filteredItems.length - maxDisplayItems} more
                </Text>
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
            <Text color="cyan">Ctrl+A</Text> select all •{' '}
            <Text color="cyan">Ctrl+U</Text> clear search
          </Text>
        </Box>
      </Box>
    </Box>
  );
};
