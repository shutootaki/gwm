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
}

export const SelectList: React.FC<SelectListProps> = ({
  items,
  onSelect,
  onCancel,
  placeholder = 'Type to search...',
  initialQuery = '',
  maxDisplayItems = 15,
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

    if (key.upArrow) {
      setSelectedIndex(Math.max(0, selectedIndex - 1));
      return;
    }

    if (key.downArrow) {
      setSelectedIndex(Math.min(filteredItems.length - 1, selectedIndex + 1));
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
          {filteredItems.slice(0, maxDisplayItems).map((item, index) => (
            <Box key={item.value}>
              <Text color={index === selectedIndex ? 'cyan' : 'white'}>
                {index === selectedIndex ? '❯ ' : '  '}
                {item.label}
              </Text>
            </Box>
          ))}
          {filteredItems.length > maxDisplayItems && (
            <Text color="gray">
              ... and {filteredItems.length - maxDisplayItems} more
            </Text>
          )}
        </Box>
      )}

      <Box marginTop={1}>
        <Text color="gray">
          ↑/↓ to navigate, Enter to select, Esc to cancel
        </Text>
      </Box>
    </Box>
  );
};
