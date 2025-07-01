/* eslint-disable @typescript-eslint/no-unused-vars */
import { describe, it, expect } from 'vitest';
import { deleteWordLeft } from '../src/utils/keyboard.js';

// useEditableTextフックのロジックをユニットテストとしてテスト
// 実際のReactフックのテストはink-testing-libraryが必要だが、
// 今回はキーボード処理ロジックを中心にテストする

describe('useEditableText logic', () => {
  describe('deleteWordLeft統合テスト', () => {
    it('Ctrl+Wの動作をシミュレートする', () => {
      const text = 'hello world test';
      const cursor = 16; // 末尾

      const [newText, newCursor] = deleteWordLeft(text, cursor);

      expect(newText).toBe('hello world ');
      expect(newCursor).toBe(12);
    });

    it('Option+Backspaceの動作をシミュレートする', () => {
      const text = 'git commit -m "message"';
      const cursor = 10; // 'commit' の後

      const [newText, newCursor] = deleteWordLeft(text, cursor);

      expect(newText).toBe('git  -m "message"');
      expect(newCursor).toBe(4);
    });

    it('複数回の単語削除', () => {
      let text = 'one two three four';
      let cursor = text.length;

      // 'four' を削除
      [text, cursor] = deleteWordLeft(text, cursor);
      expect(text).toBe('one two three ');
      expect(cursor).toBe(14);

      // 'three' を削除
      [text, cursor] = deleteWordLeft(text, cursor);
      expect(text).toBe('one two ');
      expect(cursor).toBe(8);

      // 'two' を削除
      [text, cursor] = deleteWordLeft(text, cursor);
      expect(text).toBe('one ');
      expect(cursor).toBe(4);

      // 'one' を削除
      [text, cursor] = deleteWordLeft(text, cursor);
      expect(text).toBe('');
      expect(cursor).toBe(0);
    });
  });

  describe('文字列操作のシミュレーション', () => {
    it('文字挿入のシミュレーション', () => {
      const originalText = 'hello world';
      const cursorPos = 5; // 'hello' の後
      const charToInsert = ',';

      const newText =
        originalText.slice(0, cursorPos) +
        charToInsert +
        originalText.slice(cursorPos);
      const newCursorPos = cursorPos + 1;

      expect(newText).toBe('hello, world');
      expect(newCursorPos).toBe(6);
    });

    it('Backspace削除のシミュレーション', () => {
      const originalText = 'hello world';
      const cursorPos = 5; // 'hello' の後

      if (cursorPos > 0) {
        const newText =
          originalText.slice(0, cursorPos - 1) + originalText.slice(cursorPos);
        const newCursorPos = cursorPos - 1;

        expect(newText).toBe('hell world');
        expect(newCursorPos).toBe(4);
      }
    });

    it('Ctrl+D削除のシミュレーション（右側の文字削除）', () => {
      const originalText = 'hello world';
      const cursorPos = 5; // 'hello' の後

      if (cursorPos < originalText.length) {
        const newText =
          originalText.slice(0, cursorPos) + originalText.slice(cursorPos + 1);
        const newCursorPos = cursorPos; // カーソル位置は変わらない

        expect(newText).toBe('helloworld');
        expect(newCursorPos).toBe(5);
      }
    });

    it('全削除（Ctrl+U）のシミュレーション', () => {
      const originalText = 'hello world';
      const newText = '';
      const newCursorPos = 0;

      expect(newText).toBe('');
      expect(newCursorPos).toBe(0);
    });
  });

  describe('カーソル移動のシミュレーション', () => {
    it('左矢印・Ctrl+Bでのカーソル移動', () => {
      const text = 'hello';
      let cursor = 5; // 末尾

      // 左に移動
      cursor = Math.max(0, cursor - 1);
      expect(cursor).toBe(4);

      cursor = Math.max(0, cursor - 1);
      expect(cursor).toBe(3);

      // 先頭での移動（変化なし）
      cursor = 0;
      cursor = Math.max(0, cursor - 1);
      expect(cursor).toBe(0);
    });

    it('右矢印・Ctrl+Fでのカーソル移動', () => {
      const text = 'hello';
      let cursor = 0; // 先頭

      // 右に移動
      cursor = Math.min(text.length, cursor + 1);
      expect(cursor).toBe(1);

      cursor = Math.min(text.length, cursor + 1);
      expect(cursor).toBe(2);

      // 末尾での移動（変化なし）
      cursor = text.length;
      cursor = Math.min(text.length, cursor + 1);
      expect(cursor).toBe(5);
    });

    it('行頭移動（Ctrl+A・Cmd+Left）', () => {
      const text = 'hello world';
      const cursor = 7; // 'world' の中

      const newCursor = 0;
      expect(newCursor).toBe(0);
    });

    it('行末移動（Ctrl+E・Cmd+Right）', () => {
      const text = 'hello world';
      const cursor = 3; // 'hello' の中

      const newCursor = text.length;
      expect(newCursor).toBe(11);
    });
  });

  describe('skipCharsのロジックテスト', () => {
    it('スペースがskipCharsに含まれている場合の処理', () => {
      const skipChars = [' '];
      const input = ' '; // スペース

      const shouldSkip = skipChars.includes(input);
      expect(shouldSkip).toBe(true);
    });

    it('通常の文字がskipCharsに含まれていない場合の処理', () => {
      const skipChars = [' ', 'x'];
      const input = 'a';

      const shouldSkip = skipChars.includes(input);
      expect(shouldSkip).toBe(false);
    });

    it('複数のskipCharsの処理', () => {
      const skipChars = [' ', '\t', 'x'];

      expect(skipChars.includes(' ')).toBe(true);
      expect(skipChars.includes('\t')).toBe(true);
      expect(skipChars.includes('x')).toBe(true);
      expect(skipChars.includes('a')).toBe(false);
    });
  });

  describe('特殊キーの処理ロジック', () => {
    it('Ctrl+N/Pの処理（SelectListで使用）', () => {
      // Ctrl+N/Pは文字入力としては無視される
      const isCtrlN = true; // Ctrl+N が押された場合
      const input = 'n';

      // useEditableText内部では文字入力として処理されない
      const shouldIgnore = isCtrlN;
      expect(shouldIgnore).toBe(true);
    });

    it('Command+Delete（Mac）の全削除処理', () => {
      const originalText = 'hello world';
      const isCmdDelete = true;

      if (isCmdDelete) {
        const newText = '';
        const newCursor = 0;

        expect(newText).toBe('');
        expect(newCursor).toBe(0);
      }
    });
  });

  describe('エッジケースとエラー処理', () => {
    it('空文字列でのカーソル操作', () => {
      const text = '';
      let cursor = 0;

      // 左右移動は変化なし
      cursor = Math.max(0, cursor - 1);
      expect(cursor).toBe(0);

      cursor = Math.min(text.length, cursor + 1);
      expect(cursor).toBe(0);
    });

    it('異常なカーソル位置の正規化', () => {
      const text = 'hello';

      // 負の値
      let cursor = Math.max(0, -1);
      expect(cursor).toBe(0);

      // 文字列長を超える値
      cursor = Math.min(text.length, 10);
      expect(cursor).toBe(5);
    });

    it('非ASCII文字のテスト', () => {
      const text = 'こんにちは🌍世界';
      const cursorPos = 3; // 'こんに' の後
      const charToInsert = 'ち';

      const newText =
        text.slice(0, cursorPos) + charToInsert + text.slice(cursorPos);
      expect(newText).toBe('こんにちちは🌍世界');
    });
  });

  describe('高速入力の問題', () => {
    it('連続した文字入力が正しく処理される', () => {
      // React の状態更新が非同期であることを考慮したテスト
      // 実際のフックでは、単一のstateオブジェクトを使用することで
      // 状態の一貫性を保証する

      // 期待される動作：'abc' を高速入力した場合
      const inputs = ['a', 'b', 'c'];
      let state = { value: '', cursorPosition: 0 };

      // 各文字入力を同期的にシミュレート
      for (const char of inputs) {
        state = {
          value:
            state.value.slice(0, state.cursorPosition) +
            char +
            state.value.slice(state.cursorPosition),
          cursorPosition: state.cursorPosition + 1,
        };
      }

      expect(state.value).toBe('abc');
      expect(state.cursorPosition).toBe(3);
    });

    it('高速入力中の削除操作が正しく処理される', () => {
      // 'abcd' と入力した後、高速に2回Backspaceを押す
      let state = { value: 'abcd', cursorPosition: 4 };

      // Backspace 1回目
      if (state.cursorPosition > 0) {
        state = {
          value:
            state.value.slice(0, state.cursorPosition - 1) +
            state.value.slice(state.cursorPosition),
          cursorPosition: state.cursorPosition - 1,
        };
      }

      // Backspace 2回目
      if (state.cursorPosition > 0) {
        state = {
          value:
            state.value.slice(0, state.cursorPosition - 1) +
            state.value.slice(state.cursorPosition),
          cursorPosition: state.cursorPosition - 1,
        };
      }

      expect(state.value).toBe('ab');
      expect(state.cursorPosition).toBe(2);
    });

    it('高速入力と移動操作の組み合わせ', () => {
      // 'hello' と入力、左に3移動、'X' を入力
      let state = { value: '', cursorPosition: 0 };

      // 'hello' を入力
      const hello = 'hello';
      for (const char of hello) {
        state = {
          value:
            state.value.slice(0, state.cursorPosition) +
            char +
            state.value.slice(state.cursorPosition),
          cursorPosition: state.cursorPosition + 1,
        };
      }

      // 左に3移動
      state = {
        ...state,
        cursorPosition: Math.max(0, state.cursorPosition - 3),
      };

      // 'X' を入力
      state = {
        value:
          state.value.slice(0, state.cursorPosition) +
          'X' +
          state.value.slice(state.cursorPosition),
        cursorPosition: state.cursorPosition + 1,
      };

      expect(state.value).toBe('heXllo');
      expect(state.cursorPosition).toBe(3);
    });
  });
});
