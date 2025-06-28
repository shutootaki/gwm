import { useState } from 'react';
import { useInput } from 'ink';
import { deleteWordLeft } from '../utils/keyboard.js';

interface UseEditableTextOptions {
  /** 初期文字列 */
  initialValue?: string;
  /** 入力として扱わずスキップする文字（例: MultiSelectList のスペース） */
  skipChars?: string[];
}

/**
 * Ink の useInput を用いたカーソル付き文字列編集ロジックを共通化したカスタムフック。
 * TextInput / SelectList / MultiSelectList で共通のショートカットに対応する。
 */
export function useEditableText(options: UseEditableTextOptions = {}) {
  const { initialValue = '', skipChars = [] } = options;

  const [value, setValue] = useState<string>(initialValue);
  const [cursorPosition, setCursorPosition] = useState<number>(
    initialValue.length
  );

  // 共通の文字編集ショートカットを処理
  useInput((input, key) => {
    // 左矢印 or Ctrl+B: カーソルを左に移動
    if (key.leftArrow || (key.ctrl && input === 'b')) {
      setCursorPosition((pos) => Math.max(0, pos - 1));
      return;
    }

    // 右矢印 or Ctrl+F: カーソルを右に移動
    if (key.rightArrow || (key.ctrl && input === 'f')) {
      setCursorPosition((pos) => Math.min(value.length, pos + 1));
      return;
    }

    // Cmd+Left or Ctrl+A: 行頭に移動
    if ((key.meta && key.leftArrow) || (key.ctrl && input === 'a')) {
      setCursorPosition(0);
      return;
    }

    // Cmd+Right or Ctrl+E: 行末に移動
    if ((key.meta && key.rightArrow) || (key.ctrl && input === 'e')) {
      setCursorPosition(value.length);
      return;
    }

    // Backspace: カーソルの左の文字を削除
    if (key.backspace) {
      setValue((prev) => {
        if (cursorPosition === 0) return prev;
        const newValue =
          prev.slice(0, cursorPosition - 1) + prev.slice(cursorPosition);
        setCursorPosition((pos) => pos - 1);
        return newValue;
      });
      return;
    }

    // Delete: バックスペースと同義（Mac）
    if (key.delete && !key.meta) {
      setValue((prev) => {
        if (cursorPosition === 0) return prev;
        const newValue =
          prev.slice(0, cursorPosition - 1) + prev.slice(cursorPosition);
        setCursorPosition((pos) => pos - 1);
        return newValue;
      });
      return;
    }

    // Ctrl+D: 右側の文字を1文字削除
    if (key.ctrl && input === 'd') {
      setValue((prev) => {
        if (cursorPosition >= prev.length) return prev;
        return prev.slice(0, cursorPosition) + prev.slice(cursorPosition + 1);
      });
      return;
    }

    // Ctrl+U: 全削除
    if (key.ctrl && input === 'u') {
      setValue('');
      setCursorPosition(0);
      return;
    }

    // Ctrl+W または Option+Backspace: 直前の単語を削除
    if ((key.ctrl && input === 'w') || (key.meta && key.backspace)) {
      if (cursorPosition > 0) {
        const [newValue, newPos] = deleteWordLeft(value, cursorPosition);
        setValue(newValue);
        setCursorPosition(newPos);
      }
      return;
    }

    // Command+Delete (Mac): 全削除
    if ((key.meta && key.delete) || (key.meta && input === '\u007F')) {
      setValue('');
      setCursorPosition(0);
      return;
    }

    // 通常の文字入力（スキップ指定されていない）
    if (input && input.length === 1 && !skipChars.includes(input)) {
      const newValue =
        value.slice(0, cursorPosition) + input + value.slice(cursorPosition);
      setValue(newValue);
      setCursorPosition((pos) => pos + 1);
    }
  });

  return { value, setValue, cursorPosition, setCursorPosition } as const;
}
