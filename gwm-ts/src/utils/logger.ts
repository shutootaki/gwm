import { isTestEnvironment } from './common/index.js';

/**
 * ANSI カラーコード
 */
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  gray: '\x1b[90m',
  reset: '\x1b[0m',
  bold: '\x1b[1m',
} as const;

/**
 * ロガーインターフェース
 */
export interface Logger {
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
  warn: (message: string) => void;
}

/**
 * 色付きログユーティリティを作成
 *
 * @param suppressInTest true の場合、テスト環境ではログを出力しない
 */
export function createLogger(suppressInTest = true): Logger {
  const shouldLog = (): boolean => !suppressInTest || !isTestEnvironment();

  return {
    success: (message: string): void => {
      if (shouldLog()) {
        console.log(`${colors.green}${message}${colors.reset}`);
      }
    },
    error: (message: string): void => {
      if (shouldLog()) {
        console.error(`${colors.red}${message}${colors.reset}`);
      }
    },
    info: (message: string): void => {
      if (shouldLog()) {
        console.log(`${colors.gray}${message}${colors.reset}`);
      }
    },
    warn: (message: string): void => {
      if (shouldLog()) {
        console.warn(`${colors.yellow}${message}${colors.reset}`);
      }
    },
  };
}

/**
 * デフォルトロガー（テスト環境では出力抑制）
 */
export const logger = createLogger(true);
