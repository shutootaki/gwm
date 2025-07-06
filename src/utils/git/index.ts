// 型定義
export type {
  Worktree,
  PullResult,
  CleanableWorktree,
  RemoteBranchInfo,
  CopyFilesResult,
  LocalChanges,
  RemoteBranchStatus,
} from './types.js';

// コア機能
export {
  isGitRepository,
  fetchAndPrune,
  removeWorktree,
  getRepositoryName,
  localBranchExists,
  hasUnmergedCommits,
  deleteLocalBranch,
  getRepoRoot,
} from './core.js';

// ワークツリー操作
export {
  parseWorktrees,
  getWorktreesWithStatus,
  pullMainBranch,
  getMainWorktreePath,
} from './worktree.js';

// リモートブランチ操作
export {
  checkRemoteBranchStatus,
  getRemoteBranchesWithInfo,
} from './remote.js';

// クリーンアップ操作
export { checkLocalChanges, getCleanableWorktrees } from './clean.js';

// ファイルコピー操作
export { getIgnoredFiles, copyFiles } from './copy.js';
