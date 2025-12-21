/**
 * ローカルブランチ候補プロバイダ
 * add --from コマンドで使用
 */

import { createGitProvider } from './base.js';
import { execAsync } from '../../utils/shell.js';

/**
 * ローカルブランチ候補を取得
 * Git リポジトリ外では空配列を返す
 */
export const getLocalBranchCandidates = createGitProvider({
  id: 'localBranches',
  fetch: async () => {
    const { stdout } = await execAsync(
      'git for-each-ref refs/heads --format="%(refname:short)"',
      { encoding: 'utf8' }
    );
    return stdout.split('\n').filter((line) => line.trim());
  },
  transform: (branch) => ({ value: branch }),
});
