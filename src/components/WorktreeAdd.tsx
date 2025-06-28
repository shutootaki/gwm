import React, { useState, useEffect, useCallback } from 'react';
import { Text, Box } from 'ink';
import { execSync } from 'child_process';
import { join } from 'path';
import { loadConfig } from '../config.js';
import { SelectList } from './SelectList.js';
import {
  TextInput,
  validateBranchName,
  generateWorktreePreview,
} from './TextInput.js';
import { SelectItem } from '../types/index.js';
import { formatErrorForDisplay } from '../utils/index.js';
import { getRepositoryName } from '../utils/git.js';

// シェルエスケープ用のヘルパー関数
function escapeShellArg(arg: string): string {
  return `"${arg.replace(/"/g, '\\"')}"`;
}

interface WorktreeAddProps {
  branchName?: string;
  isRemote?: boolean;
  fromBranch?: string;
}

interface RemoteBranch {
  name: string;
  fullName: string;
}

type ViewMode = 'input' | 'select' | 'loading';

export const WorktreeAdd: React.FC<WorktreeAddProps> = ({
  branchName,
  isRemote = false,
  fromBranch,
}) => {
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [remoteBranches, setRemoteBranches] = useState<RemoteBranch[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>('input');
  const [isRemoteBranchesLoaded, setIsRemoteBranchesLoaded] = useState(false);

  const config = loadConfig();

  const createWorktree = useCallback(
    (branch: string, remote: boolean) => {
      try {
        const repoName = getRepositoryName();
        const sanitizedBranch = branch.replace(/\//g, '-');
        const worktreePath = join(
          config.worktree_base_path,
          repoName,
          sanitizedBranch
        );

        let command: string;

        if (remote) {
          // リモートブランチの場合
          command = `git worktree add ${escapeShellArg(worktreePath)} -b ${escapeShellArg(branch)} ${escapeShellArg(`origin/${branch}`)}`;
        } else {
          // ローカルブランチまたは新規作成の場合
          const baseBranch = fromBranch || config.main_branches[0];

          // ローカルブランチが存在するかチェック
          try {
            execSync(
              `git show-ref --verify --quiet ${escapeShellArg(`refs/heads/${branch}`)}`,
              {
                cwd: process.cwd(),
              }
            );
            // 存在する場合、そのブランチで作成
            command = `git worktree add ${escapeShellArg(worktreePath)} ${escapeShellArg(branch)}`;
          } catch {
            // 存在しない場合、新規作成
            command = `git worktree add ${escapeShellArg(worktreePath)} -b ${escapeShellArg(branch)} ${escapeShellArg(baseBranch)}`;
          }
        }

        execSync(command, { cwd: process.cwd() });
        setSuccess(worktreePath);
      } catch (err) {
        setError(formatErrorForDisplay(err));
      }
    },
    [config, fromBranch]
  );

  const fetchRemoteBranches = async () => {
    try {
      // リモート一覧を取得して fetch
      const remotes = execSync('git remote', {
        cwd: process.cwd(),
        encoding: 'utf8',
      })
        .split('\n')
        .map((r) => r.trim())
        .filter(Boolean);

      const targetRemotes = remotes.includes('origin') ? ['origin'] : remotes;
      for (const remote of targetRemotes) {
        execSync(`git fetch ${remote}`, { cwd: process.cwd() });
      }

      // リモートブランチ一覧を取得
      const output = execSync('git branch -r', {
        cwd: process.cwd(),
        encoding: 'utf8',
      });

      const branches = output
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line && !line.includes('HEAD'))
        .map((line) => {
          const fullName = line.replace('origin/', '');
          return {
            name: fullName,
            fullName: line,
          };
        });

      setRemoteBranches(branches);
      setIsRemoteBranchesLoaded(true);
      setViewMode('select');
    } catch (err) {
      setError(formatErrorForDisplay(err));
    }
  };

  useEffect(() => {
    if (branchName) {
      // 引数でブランチ名が指定された場合、直接作成
      createWorktree(branchName, isRemote);
    } else if (isRemote) {
      // -r フラグが指定された場合、リモートブランチ選択モードに
      setViewMode('loading');
      fetchRemoteBranches();
    } else {
      // 引数なしの場合、デフォルトで新規ブランチ入力モード
      setViewMode('input');
    }
  }, [branchName, isRemote, createWorktree]);

  const handleBranchSelect = (item: SelectItem) => {
    createWorktree(item.value, true);
  };

  const handleBranchInput = (branchName: string) => {
    createWorktree(branchName, false);
  };

  const handleCancel = () => {
    setError('Operation cancelled');
  };

  const handleModeSwitch = () => {
    if (viewMode === 'input') {
      // 新規ブランチ入力からリモートブランチ選択に切り替え
      if (!isRemoteBranchesLoaded) {
        setViewMode('loading');
        fetchRemoteBranches();
      } else {
        setViewMode('select');
      }
    } else if (viewMode === 'select') {
      // リモートブランチ選択から新規ブランチ入力に切り替え
      setViewMode('input');
    }
  };

  if (success) {
    return (
      <Box flexDirection="column">
        <Box marginBottom={1}>
          <Text color="green" bold>
            Worktree created successfully!
          </Text>
        </Box>
        <Box
          flexDirection="column"
          borderStyle="single"
          borderColor="green"
          padding={1}
        >
          <Text color="white">Location:</Text>
          <Text color="cyan" bold>
            {' '}
            {success}
          </Text>
          <Text color="gray">
            Use <Text color="cyan">cd &quot;{success}&quot;</Text> to navigate
          </Text>
        </Box>
      </Box>
    );
  }

  if (error) {
    return (
      <Box flexDirection="column">
        <Box marginBottom={1}>
          <Text color="red" bold>
            Failed to create worktree
          </Text>
        </Box>
        <Box
          flexDirection="column"
          borderStyle="single"
          borderColor="red"
          padding={1}
        >
          <Text color="red">{error}</Text>
          <Text color="gray">Branch may already exist or permission issue</Text>
        </Box>
      </Box>
    );
  }

  if (viewMode === 'input') {
    return (
      <TextInput
        title="Create new worktree"
        placeholder="Enter new branch name..."
        onSubmit={handleBranchInput}
        onCancel={handleCancel}
        onModeSwitch={handleModeSwitch}
        validate={validateBranchName}
        preview={generateWorktreePreview}
      />
    );
  }

  if (viewMode === 'select') {
    const items: SelectItem[] = remoteBranches.map((branch) => ({
      label: branch.name,
      value: branch.name,
    }));

    return (
      <SelectList
        items={items}
        onSelect={handleBranchSelect}
        onCancel={handleCancel}
        title="Create worktree from remote branch"
        placeholder="Search remote branches..."
      />
    );
  }

  // viewMode === 'loading'
  return (
    <Box flexDirection="column">
      <Text color="cyan">Fetching remote branches...</Text>
      <Text color="gray">Please wait</Text>
    </Box>
  );
};
