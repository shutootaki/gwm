import React from 'react';
import { Box, Text } from 'ink';

export type NoticeVariant = 'success' | 'error' | 'warning' | 'info';

const BORDER_COLOR: Record<NoticeVariant, 'green' | 'red' | 'yellow' | 'cyan'> =
  {
    success: 'green',
    error: 'red',
    warning: 'yellow',
    info: 'cyan',
  };

interface NoticeProps {
  /** タイトル行 */
  title: string;
  /** サブメッセージ複数行 */
  messages?: string | string[];
  /** 通知タイプ */
  variant?: NoticeVariant;
}

/**
 * 枠付き通知ボックス
 *
 * variant に応じて枠線とタイトルのカラーが変わる
 */
export const Notice: React.FC<NoticeProps> = ({
  title,
  messages = [],
  variant = 'info',
}) => {
  const color = BORDER_COLOR[variant];
  const messageLines = Array.isArray(messages) ? messages : [messages];

  return (
    <Box
      flexDirection="column"
      borderStyle="single"
      borderColor={color}
      padding={1}
    >
      <Text color={color} bold>
        {title}
      </Text>
      {messageLines.map((msg, idx) => (
        <Text key={idx} color="gray">
          {msg}
        </Text>
      ))}
    </Box>
  );
};
