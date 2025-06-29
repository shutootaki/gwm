import { describe, it, expect } from 'vitest';
import { deleteWordLeft } from '../src/utils/keyboard.js';

describe('deleteWordLeft', () => {
  describe('基本的な単語削除', () => {
    it('単一の単語を削除する', () => {
      const [newText, newCursor] = deleteWordLeft('hello world', 11);
      expect(newText).toBe('hello ');
      expect(newCursor).toBe(6);
    });

    it('単語の途中から削除する', () => {
      const [newText, newCursor] = deleteWordLeft('hello world', 8);
      expect(newText).toBe('hello rld');
      expect(newCursor).toBe(6);
    });

    it('スペースを含む単語を削除する', () => {
      const [newText, newCursor] = deleteWordLeft('hello   world', 13);
      expect(newText).toBe('hello   ');
      expect(newCursor).toBe(8);
    });
  });

  describe('エッジケース', () => {
    it('カーソルが先頭にある場合は何も変更しない', () => {
      const [newText, newCursor] = deleteWordLeft('hello world', 0);
      expect(newText).toBe('hello world');
      expect(newCursor).toBe(0);
    });

    it('空文字列の場合は何も変更しない', () => {
      const [newText, newCursor] = deleteWordLeft('', 0);
      expect(newText).toBe('');
      expect(newCursor).toBe(0);
    });

    it('スペースのみの文字列では何も削除されない', () => {
      const [newText, newCursor] = deleteWordLeft('   ', 3);
      expect(newText).toBe('   ');
      expect(newCursor).toBe(3);
    });

    it('単一文字の削除', () => {
      const [newText, newCursor] = deleteWordLeft('a', 1);
      expect(newText).toBe('');
      expect(newCursor).toBe(0);
    });
  });

  describe('複数単語のテスト', () => {
    it('最初の単語の削除', () => {
      const [newText, newCursor] = deleteWordLeft('first second third', 5);
      expect(newText).toBe(' second third');
      expect(newCursor).toBe(0);
    });

    it('中間の単語の削除', () => {
      const [newText, newCursor] = deleteWordLeft('first second third', 12);
      expect(newText).toBe('first  third');
      expect(newCursor).toBe(6);
    });

    it('最後の単語の削除', () => {
      const [newText, newCursor] = deleteWordLeft('first second third', 18);
      expect(newText).toBe('first second ');
      expect(newCursor).toBe(13);
    });
  });

  describe('特殊文字のテスト', () => {
    it('記号を含む単語の削除', () => {
      const [newText, newCursor] = deleteWordLeft('hello-world test', 16);
      expect(newText).toBe('hello-world ');
      expect(newCursor).toBe(12);
    });

    it('数字を含む単語の削除', () => {
      const [newText, newCursor] = deleteWordLeft('test123 hello', 13);
      expect(newText).toBe('test123 ');
      expect(newCursor).toBe(8);
    });

    it('アンダースコアを含む単語の削除', () => {
      const [newText, newCursor] = deleteWordLeft('my_variable test', 16);
      expect(newText).toBe('my_variable ');
      expect(newCursor).toBe(12);
    });
  });

  describe('改行とタブのテスト', () => {
    it('改行文字を含むテキストの単語削除', () => {
      const [newText, newCursor] = deleteWordLeft('line1\nline2 word', 16);
      expect(newText).toBe('line1\nline2 ');
      expect(newCursor).toBe(12);
    });

    it('タブ文字を含むテキストの単語削除', () => {
      const [newText, newCursor] = deleteWordLeft('word1\tword2 test', 16);
      expect(newText).toBe('word1\tword2 ');
      expect(newCursor).toBe(12);
    });
  });

  describe('連続スペースのテスト', () => {
    it('連続スペースの後の単語削除', () => {
      const [newText, newCursor] = deleteWordLeft('word    test', 12);
      expect(newText).toBe('word    ');
      expect(newCursor).toBe(8);
    });

    it('連続スペースの途中での削除', () => {
      const [newText, newCursor] = deleteWordLeft('word    test', 8);
      expect(newText).toBe('test');
      expect(newCursor).toBe(0);
    });
  });

  describe('Unicode文字のテスト', () => {
    it('日本語文字の削除', () => {
      const [newText, newCursor] = deleteWordLeft('こんにちは world', 16);
      expect(newText).toBe('こんにちは ');
      expect(newCursor).toBe(6);
    });

    it('絵文字を含む単語の削除', () => {
      const [newText, newCursor] = deleteWordLeft('test 🎉 hello', 13);
      expect(newText).toBe('test 🎉 ');
      expect(newCursor).toBe(8);
    });
  });
});
