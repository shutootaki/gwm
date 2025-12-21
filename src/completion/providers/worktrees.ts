/**
 * Worktree 候補プロバイダ
 * go, remove コマンドで使用
 */

import { createGitProvider } from './base.js';
import { getWorktreesWithStatus } from '../../utils/git/index.js';

/**
 * Worktree 候補を取得
 * Git リポジトリ外では空配列を返す
 */
export const getWorktreeCandidates = createGitProvider({
  id: 'worktrees',
  fetch: getWorktreesWithStatus,
  transform: (wt) => {
    // ブランチ名から refs/heads/ を除去
    const branch = wt.branch.replace(/^refs\/heads\//, '');

    // ステータスに基づいて説明を追加
    let description: string | undefined;
    if (wt.isActive) {
      description = 'current';
    } else if (wt.isMain) {
      description = 'main';
    }

    return { value: branch, description };
  },
});
