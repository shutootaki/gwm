import { describe, it, expect } from 'vitest';

/**
 * コンポーネント内に実装したスクロールアルゴリズムと同等のロジックを
 * テスト用関数として再現する。
 * （React／Ink へ依存せず、純粋なアルゴリズムを検証する）
 */
function moveSelection(
  delta: number,
  selectedIndex: number,
  scrollOffset: number,
  itemsLength: number,
  maxDisplayItems: number
): { selectedIndex: number; scrollOffset: number } {
  if (itemsLength === 0) {
    return { selectedIndex, scrollOffset };
  }

  let nextIndex = selectedIndex + delta;
  nextIndex = Math.max(0, Math.min(itemsLength - 1, nextIndex));

  // スクロール位置を調整
  if (nextIndex < scrollOffset) {
    scrollOffset = nextIndex;
  } else if (nextIndex >= scrollOffset + maxDisplayItems) {
    scrollOffset = nextIndex - maxDisplayItems + 1;
  }

  return { selectedIndex: nextIndex, scrollOffset };
}

describe('Internal scroll algorithm (SelectList / MultiSelectList)', () => {
  const itemsLength = 20;
  const maxDisplayItems = 5;

  it('should keep cursor within visible window and update scrollOffset when moving down', () => {
    let selectedIndex = 0;
    let scrollOffset = 0;

    // 最初の 4 ステップはスクロールせず
    for (let i = 0; i < 4; i++) {
      ({ selectedIndex, scrollOffset } = moveSelection(
        1,
        selectedIndex,
        scrollOffset,
        itemsLength,
        maxDisplayItems
      ));
      expect(scrollOffset).toBe(0);
      expect(selectedIndex).toBe(i + 1);
    }

    // 5 回目でスクロール開始
    ({ selectedIndex, scrollOffset } = moveSelection(
      1,
      selectedIndex,
      scrollOffset,
      itemsLength,
      maxDisplayItems
    ));
    expect(selectedIndex).toBe(5);
    expect(scrollOffset).toBe(1); // 先頭が1行下がる
  });

  it('should reach the end and have max scrollOffset', () => {
    let selectedIndex = 5;
    let scrollOffset = 1;

    // 一番下まで移動
    const stepsToBottom = itemsLength - 1 - selectedIndex;
    for (let i = 0; i < stepsToBottom; i++) {
      ({ selectedIndex, scrollOffset } = moveSelection(
        1,
        selectedIndex,
        scrollOffset,
        itemsLength,
        maxDisplayItems
      ));
    }

    expect(selectedIndex).toBe(itemsLength - 1);
    expect(scrollOffset).toBe(itemsLength - maxDisplayItems); // 15 (=20-5)
  });

  it('should scroll back up when moving above current window', () => {
    let selectedIndex = itemsLength - 1; // 19
    let scrollOffset = itemsLength - maxDisplayItems; // 15

    // 上へ 10 ステップ
    for (let i = 0; i < 10; i++) {
      ({ selectedIndex, scrollOffset } = moveSelection(
        -1,
        selectedIndex,
        scrollOffset,
        itemsLength,
        maxDisplayItems
      ));
    }

    expect(selectedIndex).toBe(9);
    // 選択が 9 行目になったので、スクロールは 9
    expect(scrollOffset).toBe(9);
  });
});
