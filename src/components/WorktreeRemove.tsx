import React, { useState, useEffect } from 'react';
import { Text, Box } from 'ink';
import { MultiSelectList } from './MultiSelectList.js';
import { SelectItem } from '../types/index.js';
import {
  getWorktreesWithStatus,
  removeWorktree,
  deleteLocalBranch,
  localBranchExists,
  hasUnmergedCommits,
  Worktree,
} from '../utils/index.js';
import { loadConfig } from '../config.js';

interface WorktreeRemoveProps {
  query?: string;
  force?: boolean;
  cleanBranch?: 'auto' | 'ask' | 'never';
}

export const WorktreeRemove: React.FC<WorktreeRemoveProps> = ({
  query = '',
  force = false,
  cleanBranch,
}) => {
  const config = loadConfig();
  const cleanMode = cleanBranch || config.clean_branch;
  const [worktrees, setWorktrees] = useState<Worktree[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string[]>([]);
  const [branchSuccess, setBranchSuccess] = useState<string[]>([]);
  const [removing, setRemoving] = useState(false);

  useEffect(() => {
    const loadWorktrees = async () => {
      try {
        const allWorktrees = await getWorktreesWithStatus();
        // メインworktreeを除外
        const nonMainWorktrees = allWorktrees.filter((w) => !w.isMain);
        setWorktrees(nonMainWorktrees);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      }
    };

    loadWorktrees();
  }, []);

  const handleConfirm = async (selectedItems: SelectItem[]) => {
    if (selectedItems.length === 0) {
      setError('No worktrees selected');
      return;
    }

    setRemoving(true);
    const removedPaths: string[] = [];
    const errors: string[] = [];
    const removedBranches: Set<string> = new Set();

    for (const item of selectedItems) {
      try {
        removeWorktree(item.value, force);
        removedPaths.push(item.value);

        const wt = worktrees.find((w) => w.path === item.value);
        if (wt) removedBranches.add(wt.branch);
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Unknown error';
        errors.push(`${item.value}: ${errorMsg}`);
      }
    }

    // ブランチクリーンアップ処理
    if (removedBranches.size > 0 && cleanMode !== 'never') {
      const remaining = await getWorktreesWithStatus();

      const candidateBranches = Array.from(removedBranches).filter(
        (br) => !remaining.some((w) => w.branch === br) && localBranchExists(br)
      );

      if (cleanMode === 'auto') {
        const deleted: string[] = [];
        candidateBranches.forEach((br) => {
          const unmerged = hasUnmergedCommits(br);
          try {
            deleteLocalBranch(br, unmerged);
            deleted.push(br + (unmerged ? ' (forced)' : ''));
          } catch (e) {
            errors.push(`branch ${br}: ${e instanceof Error ? e.message : e}`);
          }
        });
        if (deleted.length > 0) {
          setBranchSuccess(deleted);
        }
      }
      // "ask" モードは未実装。スキップして注意喚起
      if (cleanMode === 'ask') {
        if (candidateBranches.length > 0) {
          errors.push(
            `Branches ${candidateBranches.join(', ')} remain locally. Re-run with --clean-branch=auto to remove.`
          );
        }
      }
    }

    if (errors.length > 0) {
      setError(errors.join('\n'));
    }

    if (removedPaths.length > 0) {
      setSuccess(removedPaths);
    }

    setRemoving(false);
  };

  const handleCancel = () => {
    setError('Cancelled');
  };

  if (success.length > 0) {
    return (
      <Box
        flexDirection="column"
        borderStyle="single"
        borderColor="green"
        padding={1}
      >
        <Text color="green" bold>
          Successfully removed {success.length} worktree(s):
        </Text>
        {success.map((path) => (
          <Text key={path} color="gray">
            {' '}
            ✓ {path}
          </Text>
        ))}
        {branchSuccess.map((b) => (
          <Text key={b} color="gray">
            {' '}
            ✓ cleaned branch {b}
          </Text>
        ))}
      </Box>
    );
  }

  if (error) {
    return (
      <Box
        flexDirection="column"
        borderStyle="single"
        borderColor="red"
        padding={1}
      >
        <Text color="red" bold>
          Error: {error}
        </Text>
      </Box>
    );
  }

  if (removing) {
    return (
      <Box
        flexDirection="column"
        borderStyle="single"
        borderColor="yellow"
        padding={1}
      >
        <Text color="yellow" bold>
          Removing worktrees...
        </Text>
        <Text color="gray">Please wait...</Text>
      </Box>
    );
  }

  if (worktrees.length === 0) {
    return (
      <Box
        flexDirection="column"
        borderStyle="single"
        borderColor="gray"
        padding={1}
      >
        <Text color="gray" bold>
          No removable worktrees found
        </Text>
        <Text color="gray">Main worktree cannot be removed</Text>
      </Box>
    );
  }

  const items: SelectItem[] = worktrees.map((worktree) => ({
    label: `${worktree.branch.padEnd(30)} ${worktree.path}`,
    value: worktree.path,
  }));

  return (
    <MultiSelectList
      items={items}
      onConfirm={handleConfirm}
      onCancel={handleCancel}
      title={`Remove worktrees${force ? ' (force mode)' : ''}`}
      placeholder={`Select worktrees to remove${force ? ' (force mode)' : ''}...`}
      initialQuery={query}
    />
  );
};
