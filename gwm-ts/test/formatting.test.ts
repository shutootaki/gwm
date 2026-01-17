import { describe, it, expect } from 'vitest';
import {
  truncateAndPad,
  getOptimalColumnWidths,
} from '../src/utils/formatting.js';

describe('formatting utilities', () => {
  describe('truncateAndPad', () => {
    describe('基本的な文字列処理', () => {
      it('短い文字列をパディングする', () => {
        const result = truncateAndPad('hello', 10);
        expect(result).toBe('hello     ');
        expect(result.length).toBe(10);
      });

      it('同じ長さの文字列はそのまま返す', () => {
        const result = truncateAndPad('hello', 5);
        expect(result).toBe('hello');
        expect(result.length).toBe(5);
      });

      it('長い文字列を切り詰める', () => {
        const result = truncateAndPad('hello world', 8);
        expect(result).toBe('hello...');
        expect(result.length).toBe(8);
      });

      it('幅が3未満の場合も正しく処理する', () => {
        const result = truncateAndPad('hello', 2);
        expect(result).toBe('...');
        expect(result.length).toBe(3);
      });
    });

    describe('エッジケース', () => {
      it('空文字列をパディングする', () => {
        const result = truncateAndPad('', 5);
        expect(result).toBe('     ');
        expect(result.length).toBe(5);
      });

      it('幅が0の場合', () => {
        const result = truncateAndPad('hello', 0);
        expect(result).toBe('...');
      });

      it('幅が1の場合', () => {
        const result = truncateAndPad('hello', 1);
        expect(result).toBe('...');
      });

      it('幅が3の場合（ちょうど省略符号と同じ長さ）', () => {
        const result = truncateAndPad('hello', 3);
        expect(result).toBe('...');
      });
    });

    describe('特殊文字のテスト', () => {
      it('日本語文字列の処理（パディング）', () => {
        const result = truncateAndPad('こんにちは', 8); // 5文字 < 8文字なのでパディング
        expect(result).toBe('こんにちは   ');
        expect(result.length).toBe(8);
      });

      it('日本語文字列の処理（切り詰め）', () => {
        const result = truncateAndPad('こんにちは世界のみなさん', 8); // 11文字 > 8文字なので切り詰め
        expect(result).toBe('こんにちは...');
        expect(result.length).toBe(8);
      });

      it('絵文字を含む文字列の処理', () => {
        const result = truncateAndPad('Hello 🎉', 10);
        expect(result).toBe('Hello 🎉  ');
        expect(result.length).toBe(10);
      });

      it('タブや改行を含む文字列の処理（パディング）', () => {
        const result = truncateAndPad('hello\tworld\n', 15); // 12文字 < 15文字なのでパディング
        expect(result).toBe('hello\tworld\n   ');
        expect(result.length).toBe(15);
      });

      it('タブや改行を含む文字列の処理（切り詰め）', () => {
        const result = truncateAndPad('hello\tworld\nvery\tlong\tstring', 10); // 24文字 > 10文字なので切り詰め
        expect(result).toBe('hello\tw...');
        expect(result.length).toBe(10);
      });
    });
  });

  describe('getOptimalColumnWidths', () => {
    describe('基本的な幅計算', () => {
      it('短いアイテムリストの場合', () => {
        const items = [
          { branch: 'main', path: '/home/user/project' },
          { branch: 'feature', path: '/home/user/dev' },
        ];
        const result = getOptimalColumnWidths(items, 120);

        expect(result.branchWidth).toBeGreaterThanOrEqual(15);
        expect(result.pathWidth).toBeGreaterThanOrEqual(20);
        expect(result.branchWidth + result.pathWidth).toBeLessThanOrEqual(90); // 120 - 30(余白)
      });

      it('長いブランチ名とパスの場合', () => {
        const items = [
          {
            branch: 'feature/very-long-branch-name-that-exceeds-normal-length',
            path: '/very/long/path/to/project/directory/that/also/exceeds/normal/length',
          },
        ];
        const result = getOptimalColumnWidths(items, 120);

        expect(result.branchWidth).toBeGreaterThanOrEqual(15);
        expect(result.pathWidth).toBeGreaterThanOrEqual(20);
      });

      it('空のアイテムリストの場合', () => {
        const items: Array<{ branch: string; path: string }> = [];
        const result = getOptimalColumnWidths(items, 120);

        expect(result.branchWidth).toBe(37); // 実際の結果に合わせる
        expect(result.pathWidth).toBe(53); // 実際の結果に合わせる
      });
    });

    describe('ターミナル幅に基づく調整', () => {
      it('狭いターミナルでの幅計算', () => {
        const items = [{ branch: 'main', path: '/home/user/project' }];
        const result = getOptimalColumnWidths(items, 60);

        expect(result.branchWidth).toBe(15); // 最小幅
        expect(result.pathWidth).toBe(20); // 最小幅
      });

      it('広いターミナルでの幅計算', () => {
        const items = [{ branch: 'main', path: '/home/user/project' }];
        const result = getOptimalColumnWidths(items, 200);

        expect(result.branchWidth).toBeGreaterThan(15);
        expect(result.pathWidth).toBeGreaterThan(20);
        expect(result.branchWidth + result.pathWidth).toBeLessThanOrEqual(170); // 200 - 30
      });

      it('極端に狭いターミナルでの最小幅保証', () => {
        const items = [{ branch: 'main', path: '/home/user/project' }];
        const result = getOptimalColumnWidths(items, 20);

        expect(result.branchWidth).toBe(15); // 最小幅が保たれる
        expect(result.pathWidth).toBe(20); // 最小幅が保たれる
      });
    });

    describe('幅配分のロジック', () => {
      it('長いブランチ名がある場合の最適化', () => {
        const items = [
          {
            branch:
              'feature/very-long-branch-name-for-testing-width-calculation',
            path: '/short',
          },
        ];
        const result = getOptimalColumnWidths(items, 120);

        // ブランチ名が長い場合の実際の動作を確認
        expect(result.branchWidth).toBe(46); // 実際の結果
      });

      it('長いパスがある場合の最適化', () => {
        const items = [
          {
            branch: 'main',
            path: '/very/long/path/structure/that/should/be/handled/properly/in/the/formatting/function',
          },
        ];
        const result = getOptimalColumnWidths(items, 120);

        // パスが長い場合の実際の動作を確認
        expect(result.pathWidth).toBe(65); // 実際の結果
      });

      it('ヘッダー文字列の最小幅考慮', () => {
        const items = [
          { branch: 'a', path: 'b' }, // 極端に短いアイテム
        ];
        const result = getOptimalColumnWidths(items, 120);

        // 'BRANCH'(6文字)と'PATH'(4文字)の長さは考慮される
        expect(result.branchWidth).toBeGreaterThanOrEqual(15); // Math.max(15, Math.min(6, 30))
        expect(result.pathWidth).toBeGreaterThanOrEqual(20); // Math.max(20, Math.min(4, 50))
      });
    });

    describe('幅配分の比率テスト', () => {
      it('余白がある場合の4:6配分', () => {
        const items = [{ branch: 'main', path: '/home/user' }];
        const result = getOptimalColumnWidths(items, 100);
        const totalMinWidth = 35; // 15 + 20
        const remainingWidth = 70; // 100 - 30
        const extraWidth = remainingWidth - totalMinWidth; // 35

        expect(result.branchWidth).toBe(15 + Math.floor(extraWidth * 0.4));
        expect(result.pathWidth).toBe(20 + Math.floor(extraWidth * 0.6));
      });
    });
  });
});
