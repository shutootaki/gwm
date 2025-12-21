/**
 * リモートブランチ候補プロバイダ
 * add -r コマンドで使用
 */

import { createGitProvider } from './base.js';
import { getRemoteBranchesWithInfo } from '../../utils/git/index.js';

/**
 * リモートブランチ候補を取得
 * Git リポジトリ外では空配列を返す
 */
export const getRemoteBranchCandidates = createGitProvider({
  id: 'remoteBranchesOrigin',
  fetch: getRemoteBranchesWithInfo,
  transform: (b) => ({
    value: b.name,
    description: b.lastCommitterName || undefined,
  }),
});
