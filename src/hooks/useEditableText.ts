import { useState } from 'react';
import { useInput } from 'ink';
import { deleteWordLeft } from '../utils/keyboard.js';

interface UseEditableTextOptions {
  /** 初期文字列 */
  initialValue?: string;
  /** 入力として扱わずスキップする文字（例: MultiSelectList のスペース） */
  skipChars?: string[];
}

interface EditableTextState {
  value: string;
  cursorPosition: number;
}

/**
 * Ink の useInput を用いたカーソル付き文字列編集ロジックを共通化したカスタムフック。
 * TextInput / SelectList / MultiSelectList で共通のショートカットに対応する。
 */
export function useEditableText(options: UseEditableTextOptions = {}) {
  const { initialValue = '', skipChars = [] } = options;

  const [state, setState] = useState<EditableTextState>({
    value: initialValue,
    cursorPosition: initialValue.length,
  });

  // 共通の文字編集ショートカットを処理
  useInput((input, key) => {
    // 左矢印 or Ctrl+B: カーソルを左に移動
    if (key.leftArrow || (key.ctrl && input === 'b')) {
      setState((prev) => ({
        ...prev,
        cursorPosition: Math.max(0, prev.cursorPosition - 1),
      }));
      return;
    }

    // 右矢印 or Ctrl+F: カーソルを右に移動
    if (key.rightArrow || (key.ctrl && input === 'f')) {
      setState((prev) => ({
        ...prev,
        cursorPosition: Math.min(prev.value.length, prev.cursorPosition + 1),
      }));
      return;
    }

    // Cmd+Left or Ctrl+A: 行頭に移動
    if ((key.meta && key.leftArrow) || (key.ctrl && input === 'a')) {
      setState((prev) => ({
        ...prev,
        cursorPosition: 0,
      }));
      return;
    }

    // Cmd+Right or Ctrl+E: 行末に移動
    if ((key.meta && key.rightArrow) || (key.ctrl && input === 'e')) {
      setState((prev) => ({
        ...prev,
        cursorPosition: prev.value.length,
      }));
      return;
    }

    // Backspace: カーソルの左の文字を削除
    if (key.backspace) {
      setState((prev) => {
        if (prev.cursorPosition === 0) return prev;
        return {
          value:
            prev.value.slice(0, prev.cursorPosition - 1) +
            prev.value.slice(prev.cursorPosition),
          cursorPosition: prev.cursorPosition - 1,
        };
      });
      return;
    }

    // Delete: バックスペースと同義（Mac）
    if (key.delete && !key.meta) {
      setState((prev) => {
        if (prev.cursorPosition === 0) return prev;
        return {
          value:
            prev.value.slice(0, prev.cursorPosition - 1) +
            prev.value.slice(prev.cursorPosition),
          cursorPosition: prev.cursorPosition - 1,
        };
      });
      return;
    }

    // Ctrl+D: 右側の文字を1文字削除
    if (key.ctrl && input === 'd') {
      setState((prev) => {
        if (prev.cursorPosition >= prev.value.length) return prev;
        return {
          value:
            prev.value.slice(0, prev.cursorPosition) +
            prev.value.slice(prev.cursorPosition + 1),
          cursorPosition: prev.cursorPosition,
        };
      });
      return;
    }

    // Ctrl+U: 全削除
    if (key.ctrl && input === 'u') {
      setState({
        value: '',
        cursorPosition: 0,
      });
      return;
    }

    // Ctrl+W または Option+Backspace: 直前の単語を削除
    if ((key.ctrl && input === 'w') || (key.meta && key.backspace)) {
      setState((prev) => {
        if (prev.cursorPosition > 0) {
          const [newValue, newPos] = deleteWordLeft(
            prev.value,
            prev.cursorPosition
          );
          return {
            value: newValue,
            cursorPosition: newPos,
          };
        }
        return prev;
      });
      return;
    }

    // Command+Delete (Mac): 全削除
    if ((key.meta && key.delete) || (key.meta && input === '\u007F')) {
      setState({
        value: '',
        cursorPosition: 0,
      });
      return;
    }

    // Ctrl+N / Ctrl+P: SelectList や MultiSelectList でカーソル移動として使うため、文字入力としては無視する
    if (key.ctrl && (input === 'n' || input === 'p')) {
      return;
    }

    // 通常の文字入力（スキップ指定されていない）
    if (input && input.length === 1 && !skipChars.includes(input)) {
      setState((prev) => ({
        value:
          prev.value.slice(0, prev.cursorPosition) +
          input +
          prev.value.slice(prev.cursorPosition),
        cursorPosition: prev.cursorPosition + 1,
      }));
    }
  });

  return {
    value: state.value,
    setValue: (newValue: string) =>
      setState((prev) => ({ ...prev, value: newValue })),
    cursorPosition: state.cursorPosition,
    setCursorPosition: (newPos: number) =>
      setState((prev) => ({ ...prev, cursorPosition: newPos })),
  } as const;
}
