import React from 'react';
import { Text, Box } from 'ink';
import InkSpinner from 'ink-spinner';

export interface ProgressSpinnerProps {
  /** Main label */
  label: string;
  /** Sub label (e.g., stage display) */
  sublabel?: string;
  /** Progress information */
  progress?: {
    current: number;
    total: number;
    detail?: string;
  };
  /** Spinner color */
  color?: 'cyan' | 'green' | 'yellow' | 'red' | 'white' | 'gray';
}

/**
 * Spinner with progress display
 *
 * Usage:
 *   <ProgressSpinner label="Removing worktrees..." />
 *   <ProgressSpinner
 *     label="Removing worktrees..."
 *     progress={{ current: 3, total: 5, detail: '/path/to/worktree' }}
 *   />
 */
export const ProgressSpinner: React.FC<ProgressSpinnerProps> = ({
  label,
  sublabel,
  progress,
  color = 'cyan',
}) => {
  const progressText = progress
    ? ` (${progress.current}/${progress.total})`
    : '';

  return (
    <Box flexDirection="column">
      <Text>
        <Text color={color}>
          <InkSpinner type="dots" />
        </Text>{' '}
        {label}
        {progressText}
        {sublabel && <Text color="gray"> - {sublabel}</Text>}
      </Text>
      {progress?.detail && (
        <Box marginLeft={2}>
          <Text color="gray">{progress.detail}</Text>
        </Box>
      )}
    </Box>
  );
};
