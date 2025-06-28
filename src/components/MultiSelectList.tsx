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
}

export const MultiSelectList: React.FC<MultiSelectListProps> = ({
  items,
  onConfirm,
  onCancel,
  placeholder = 'Type to search, Space to select, Enter to confirm...',
  initialQuery = '',
  maxDisplayItems = 15,
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

    if (key.upArrow) {
      setSelectedIndex(Math.max(0, selectedIndex - 1));
      return;
    }

    if (key.downArrow) {
      setSelectedIndex(Math.min(filteredItems.length - 1, selectedIndex + 1));
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

  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text color="gray">{placeholder}</Text>
      </Box>
      <Box marginBottom={1}>
        <Text color="cyan">{'> '}</Text>
        <Text>{query}</Text>
        <Text color="gray">{'█'}</Text>
      </Box>

      {filteredItems.length === 0 ? (
        <Text color="red">No matches found</Text>
      ) : (
        <Box flexDirection="column">
          {filteredItems.slice(0, maxDisplayItems).map((item, index) => {
            const isSelected = selectedItems.has(item.value);
            const isCurrent = index === selectedIndex;

            return (
              <Box key={item.value}>
                <Text color={isCurrent ? 'cyan' : 'white'}>
                  {isCurrent ? '❯ ' : '  '}
                  {isSelected ? '☑ ' : '☐ '}
                  {item.label}
                </Text>
              </Box>
            );
          })}
          {filteredItems.length > maxDisplayItems && (
            <Text color="gray">
              ... and {filteredItems.length - maxDisplayItems} more
            </Text>
          )}
        </Box>
      )}

      <Box marginTop={1}>
        <Text color="gray">
          ↑/↓ to navigate, Space to select, Enter to confirm, Esc to cancel
        </Text>
      </Box>

      {selectedItems.size > 0 && (
        <Box marginTop={1}>
          <Text color="yellow">Selected {selectedItems.size} item(s)</Text>
        </Box>
      )}
    </Box>
  );
};
