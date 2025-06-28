import React, { useState, useEffect } from 'react';
import { Text, Box, useInput } from 'ink';
import { SelectItem } from '../types/common.js';

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
  const [query, setQuery] = useState(initialQuery);
  const [selectedIndex, setSelectedIndex] = useState(0);

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
      if (filteredItems.length > 0) {
        onSelect(filteredItems[selectedIndex]);
      }
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

    if (key.backspace || key.delete) {
      setQuery(query.slice(0, -1));
      return;
    }

    if (input && input.length === 1) {
      setQuery(query + input);
    }
  });

  const currentItem = filteredItems[selectedIndex];
  const hasSelection = filteredItems.length > 0;

  return (
    <Box flexDirection="column">
      {/* Title */}
      <Box marginBottom={1}>
        <Text color="cyan" bold>{title}</Text>
      </Box>

      {/* Stats */}
      {showStats && (
        <Box marginBottom={1}>
          <Text color="gray">
            {filteredItems.length} / {items.length} items
            {hasSelection && (
              <>
                {' '}• {selectedIndex + 1} of {filteredItems.length}
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
            <Text color="cyan" bold>❯ </Text>
            <Text>{query}</Text>
            <Text color="cyan">█</Text>
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
            {filteredItems.slice(0, maxDisplayItems).map((item, index) => {
              const isSelected = index === selectedIndex;
              return (
                <Box key={item.value}>
                  <Text color={isSelected ? 'cyan' : 'white'}>
                    {isSelected ? '▶ ' : '  '}
                    <Text color={isSelected ? 'cyan' : 'white'} bold={isSelected}>
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

      {/* Preview */}
      {hasSelection && currentItem && (
        <Box marginBottom={1}>
          <Box flexDirection="column" borderStyle="single" borderColor="gray" padding={1}>
            <Text color="yellow" bold>Preview</Text>
            <Text color="white">
              <Text color="cyan" bold>{currentItem.label}</Text>
            </Text>
            {currentItem.value !== currentItem.label && (
              <Text color="gray">
                Value: {currentItem.value}
              </Text>
            )}
          </Box>
        </Box>
      )}

      {/* Help */}
      <Box>
        <Text color="gray">
          <Text color="cyan">↑/↓</Text> navigate • <Text color="green">Enter</Text> select • <Text color="red">Esc</Text> cancel • <Text color="yellow">Ctrl+U</Text> clear
        </Text>
      </Box>
    </Box>
  );
};
