import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';

export type ConfirmChoice = 'trust' | 'once' | 'cancel';

interface HookConfirmationProps {
  /** Reason why confirmation is required */
  reason: 'first-time' | 'config-changed';
  /** List of commands to be executed */
  commands: string[];
  /** Callback to receive the user's choice */
  onChoice: (choice: ConfirmChoice) => void;
}

const OPTIONS: { label: string; value: ConfirmChoice; color: string }[] = [
  { label: 'Trust & Run', value: 'trust', color: 'green' },
  { label: 'Run Once', value: 'once', color: 'yellow' },
  { label: 'Cancel', value: 'cancel', color: 'red' },
];

/**
 * Hooks execution confirmation prompt
 */
export const HookConfirmation: React.FC<HookConfirmationProps> = ({
  reason,
  commands,
  onChoice,
}) => {
  const [selectedIndex, setSelectedIndex] = useState(0);

  useInput((input, key) => {
    if (key.return) {
      onChoice(OPTIONS[selectedIndex].value);
      return;
    }

    // Number keys: direct selection
    const num = Number(input);
    if (num >= 1 && num <= OPTIONS.length) {
      setSelectedIndex(num - 1);
      return;
    }

    // Navigation
    const delta =
      (key.tab && key.shift) || key.leftArrow || input === 'h'
        ? -1
        : (key.tab && !key.shift) || key.rightArrow || input === 'l'
          ? 1
          : 0;

    if (delta) {
      setSelectedIndex((prev) =>
        Math.max(0, Math.min(OPTIONS.length - 1, prev + delta))
      );
    }
  });

  const title =
    reason === 'first-time'
      ? 'This repository has post_create hooks configured'
      : 'Project config has changed (re-confirm hooks)';

  return (
    <Box
      flexDirection="column"
      borderStyle="single"
      borderColor="yellow"
      paddingX={1}
      paddingY={1}
    >
      {/* Title */}
      <Box marginBottom={1}>
        <Text color="yellow" bold>
          {'⚠ '}
          {title}
        </Text>
      </Box>

      {/* Command list */}
      <Box flexDirection="column" marginBottom={1}>
        <Text color="gray">Commands to be executed:</Text>
        {commands.map((cmd, i) => (
          <Text key={i} color="white">
            {'  '}
            {i + 1}. {cmd}
          </Text>
        ))}
      </Box>

      {/* Options */}
      <Box marginTop={1}>
        {OPTIONS.map((opt, i) => (
          <Box key={opt.value} marginRight={2}>
            <Text
              color={selectedIndex === i ? opt.color : 'gray'}
              bold={selectedIndex === i}
              inverse={selectedIndex === i}
            >
              [{i + 1}] {opt.label}
            </Text>
          </Box>
        ))}
      </Box>

      {/* Help */}
      <Box marginTop={1}>
        <Text color="gray" dimColor>
          Tab/←/→ or 1/2/3 to select • Enter to confirm
        </Text>
      </Box>
    </Box>
  );
};
