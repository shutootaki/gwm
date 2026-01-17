export interface Worktree {
  path: string;
  branch: string;
  head: string;
  status: string;
  isActive: boolean;
  isMain: boolean;
}

export interface PullResult {
  branch: string;
  path: string;
  success: boolean;
  message: string;
}

export interface CleanableWorktree {
  worktree: Worktree;
  reason: 'remote_deleted' | 'merged';
  mergedIntoBranch?: string;
}

export interface RemoteBranchInfo {
  name: string;
  fullName: string;
  lastCommitDate: string;
  lastCommitterName: string;
  lastCommitMessage: string;
}

export interface CopyFilesResult {
  copied: string[];
  skippedVirtualEnvs: string[];
  skippedOversize: string[];
}

export interface LocalChanges {
  hasUnstagedChanges: boolean;
  hasUntrackedFiles: boolean;
  hasStagedChanges: boolean;
  hasLocalCommits: boolean;
}

export interface RemoteBranchStatus {
  isDeleted: boolean;
  isMerged: boolean;
  mergedIntoBranch?: string;
}
