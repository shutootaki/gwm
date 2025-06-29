import React from 'react';
import { Text } from 'ink';
import InkSpinner from 'ink-spinner';

interface LoadingSpinnerProps {
  /** 表示するラベル */
  label?: string;
  /** スピナーカラー */
  color?: 'cyan' | 'green' | 'yellow' | 'red' | 'white' | 'gray';
}

/**
 * ターミナル用汎用スピナー
 *
 * 使用例:
 *   <LoadingSpinner label="Fetching data..." />
 */
export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  label = 'Loading...',
  color = 'cyan',
}) => {
  return (
    <Text color={color}>
      <InkSpinner type="dots" /> {label}
    </Text>
  );
};
