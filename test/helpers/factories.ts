/**
 * テスト用ファクトリー関数
 *
 * テストデータの生成を共通化し、テストコードの重複を削減します。
 */

import type { Config } from '../../src/config/types.js';

/**
 * Worktree 型（簡易版）
 */
export interface MockWorktree {
  path: string;
  branch: string;
  head: string;
  status: 'NORMAL' | 'PRUNABLE' | 'LOCKED';
  isActive: boolean;
  isMain: boolean;
}

/**
 * デフォルトの Worktree を作成
 */
export function createMockWorktree(
  overrides: Partial<MockWorktree> = {}
): MockWorktree {
  return {
    path: '/Users/test/git-worktrees/project/main',
    branch: 'main',
    head: 'abc1234',
    status: 'NORMAL',
    isActive: false,
    isMain: true,
    ...overrides,
  };
}

/**
 * 複数の Worktree を作成
 */
export function createMockWorktrees(count: number = 3): MockWorktree[] {
  const templates: Partial<MockWorktree>[] = [
    { branch: 'main', path: '/Users/test/project', isMain: true, isActive: true },
    {
      branch: 'feature/test',
      path: '/Users/test/git-worktrees/project/feature-test',
      isMain: false,
      isActive: false,
    },
    {
      branch: 'hotfix/bug',
      path: '/Users/test/git-worktrees/project/hotfix-bug',
      isMain: false,
      isActive: false,
    },
    {
      branch: 'develop',
      path: '/Users/test/git-worktrees/project/develop',
      isMain: false,
      isActive: false,
    },
  ];

  return templates.slice(0, count).map((t) => createMockWorktree(t));
}

/**
 * デフォルトの Config を作成
 */
export function createMockConfig(overrides: Partial<Config> = {}): Config {
  return {
    worktree_base_path: '/Users/test/git-worktrees',
    main_branches: ['main', 'master'],
    clean_branch: 'ask',
    copy_ignored_files: {
      enabled: true,
      patterns: ['.env', '.env.*'],
      exclude_patterns: ['.env.example'],
    },
    hooks: {
      post_create: {
        enabled: true,
        commands: [],
      },
    },
    ...overrides,
  };
}

/**
 * hooks 付きの Config を作成
 */
export function createMockConfigWithHooks(
  commands: string[],
  enabled: boolean = true
): Config {
  return createMockConfig({
    hooks: {
      post_create: {
        enabled,
        commands,
      },
    },
  });
}

/**
 * SelectItem 型
 */
export interface MockSelectItem {
  label: string;
  value: string;
  description?: string;
}

/**
 * SelectItem を作成
 */
export function createMockSelectItem(
  overrides: Partial<MockSelectItem> = {}
): MockSelectItem {
  return {
    label: 'Test Item',
    value: 'test-item',
    description: 'A test item',
    ...overrides,
  };
}

/**
 * 複数の SelectItem を作成
 */
export function createMockSelectItems(count: number = 5): MockSelectItem[] {
  return Array.from({ length: count }, (_, i) =>
    createMockSelectItem({
      label: `Item ${i + 1}`,
      value: `item-${i + 1}`,
      description: `Description for item ${i + 1}`,
    })
  );
}
