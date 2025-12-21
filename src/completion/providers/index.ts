/**
 * 候補プロバイダのエントリーポイント
 */

// 型定義
export type { CompletionCandidate } from './types.js';

// ベース
export { createGitProvider, type ProviderConfig } from './base.js';

// キャッシュ
export { getCached, setCache, clearCache } from './cache.js';

// プロバイダ
export { getWorktreeCandidates } from './worktrees.js';
export { getLocalBranchCandidates } from './branches-local.js';
export { getRemoteBranchCandidates } from './branches-remote.js';

import type { CompletionProviderId } from '../types.js';
import type { CompletionCandidate } from './types.js';
import { getWorktreeCandidates } from './worktrees.js';
import { getLocalBranchCandidates } from './branches-local.js';
import { getRemoteBranchCandidates } from './branches-remote.js';
import { getAllCommandNames } from '../definition.js';

/**
 * プロバイダIDから候補を取得
 */
export async function getProviderCandidates(
  providerId: CompletionProviderId
): Promise<CompletionCandidate[]> {
  switch (providerId) {
    case 'worktrees':
      return getWorktreeCandidates();
    case 'localBranches':
      return getLocalBranchCandidates();
    case 'remoteBranchesOrigin':
      return getRemoteBranchCandidates();
    case 'subcommands':
      // サブコマンド一覧を静的に返す
      return getAllCommandNames().map((name) => ({ value: name }));
    case 'cleanBranchModes':
      // 静的候補
      return [
        { value: 'auto', description: 'Automatically clean merged branches' },
        { value: 'ask', description: 'Ask before cleaning' },
        { value: 'never', description: 'Never clean branches' },
      ];
    default:
      return [];
  }
}
