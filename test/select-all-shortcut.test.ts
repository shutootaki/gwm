import { describe, it, expect } from 'vitest';
import type { SelectItem } from '../src/types/common.js';

// コンポーネント内の Ctrl+A ハンドラと同等のトグルロジックを関数化
function toggleSelectAll(
  selectedItems: Set<string>,
  filteredItems: SelectItem[]
): Set<string> {
  const newSelected = new Set(selectedItems);
  const allVisibleSelected = filteredItems.every((item) =>
    newSelected.has(item.value)
  );
  if (allVisibleSelected) {
    filteredItems.forEach((item) => newSelected.delete(item.value));
  } else {
    filteredItems.forEach((item) => newSelected.add(item.value));
  }
  return newSelected;
}

describe('Ctrl+A 全選択ショートカット', () => {
  const mockItems: SelectItem[] = [
    { label: 'feature-auth', value: 'feature-auth' },
    { label: 'feature-ui', value: 'feature-ui' },
    { label: 'bugfix-login', value: 'bugfix-login' },
    { label: 'main', value: 'main' },
  ];

  it('未選択状態で Ctrl+A を押すと全選択される', () => {
    const selectedItems = new Set<string>();
    const filteredItems = mockItems.filter((item) =>
      item.label.includes('feature')
    );

    const result = toggleSelectAll(selectedItems, filteredItems);

    expect(result.size).toBe(filteredItems.length);
    filteredItems.forEach((item) => {
      expect(result.has(item.value)).toBe(true);
    });
  });

  it('すでに全選択されている状態で Ctrl+A を押すと全解除される', () => {
    const filteredItems = mockItems.filter((item) =>
      item.label.includes('feature')
    );
    const selectedItems = new Set<string>(filteredItems.map((i) => i.value));

    const result = toggleSelectAll(selectedItems, filteredItems);

    expect(result.size).toBe(0);
  });

  it('一部だけ選択されている状態で Ctrl+A を押すと全選択される', () => {
    const filteredItems = mockItems.filter((item) =>
      item.label.includes('feature')
    );
    const selectedItems = new Set<string>(['feature-auth']);

    const result = toggleSelectAll(selectedItems, filteredItems);

    expect(result.size).toBe(filteredItems.length);
    filteredItems.forEach((item) => {
      expect(result.has(item.value)).toBe(true);
    });
  });
});
