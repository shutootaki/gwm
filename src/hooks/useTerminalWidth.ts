import { useState, useEffect } from 'react';
import { useStdout } from 'ink';

/**
 * ターミナルの現在幅を返し、リサイズにも追従するカスタムフック。
 *
 * - TTY でない環境 (CI, Jest など) では `stdout` が undefined になる場合があるため、
 *   その際はフォールバック値を返す。
 * - `resize` イベントを購読し、幅が変わる度に再レンダーを発生させる。
 */
export const useTerminalWidth = (fallback: number = 120): number => {
  const { stdout } = useStdout();

  const [width, setWidth] = useState<number>(stdout?.columns ?? fallback);

  useEffect(() => {
    if (!stdout) return;

    const handler = () => {
      setWidth(stdout.columns ?? fallback);
    };

    stdout.on('resize', handler);
    return () => {
      type StreamWithOff = {
        columns?: number;
        on: (event: string, listener: () => void) => void;
        off?: (event: string, listener: () => void) => void;
        removeListener: (event: string, listener: () => void) => void;
      };

      const stream = stdout as StreamWithOff;

      if (typeof stream.off === 'function') {
        // Node v14 以降は off API がある
        stream.off('resize', handler);
      } else {
        stdout.removeListener('resize', handler);
      }
    };
  }, [stdout, fallback]);

  return width;
};
