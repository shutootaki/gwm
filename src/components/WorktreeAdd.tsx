import React, { useState, useEffect, useCallback } from 'react';
import { Text, Box } from 'ink';
import { execSync } from 'child_process';
import { SelectList } from './SelectList.js';
import {
  TextInput,
  validateBranchName,
  generateWorktreePreview,
} from './TextInput.js';
import { SelectItem } from '../types/index.js';
import { formatErrorForDisplay } from '../utils/index.js';
import { useWorktree } from '../hooks/useWorktree.js';

interface WorktreeAddProps {
  branchName?: string;
  isRemote?: boolean;
  fromBranch?: string;
  openCode?: boolean;
  openCursor?: boolean;
  outputPath?: boolean;
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
  openCode = false,
  openCursor = false,
  outputPath = false,
}) => {
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [remoteBranches, setRemoteBranches] = useState<RemoteBranch[]>([]);
  const [isRemoteBranchesLoaded, setIsRemoteBranchesLoaded] = useState(false);

  // 初期表示モードは引数有無に応じて決定する
  //   * branchName 指定あり → すぐに worktree 作成するので "loading" 表示のみ
  //   * -r 指定でリモート一覧を取りに行く場合も "loading"
  //   * それ以外は新規ブランチ入力モード
  const initialViewMode: ViewMode = branchName
    ? 'loading'
    : isRemote
      ? 'loading'
      : 'input';

  const [viewMode, setViewMode] = useState<ViewMode>(initialViewMode);

  // onSuccess / onError の参照が毎レンダー変わらないように useCallback でメモ化
  const handleSuccess = useCallback(
    (data: { path: string; actions: string[] }) => {
      setSuccess(JSON.stringify(data));
    },
    []
  );

  const handleError = useCallback((message: string) => {
    setError(message);
  }, []);

  const { createWorktree } = useWorktree({
    fromBranch,
    openCode,
    openCursor,
    outputPath,
    onSuccess: handleSuccess,
    onError: handleError,
  });

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

  // 成功してエディタを開いた場合は 1 秒後に自動で CLI を終了する
  useEffect(() => {
    if (success && (openCode || openCursor)) {
      const timer = setTimeout(() => process.exit(0), 1000);
      return () => clearTimeout(timer);
    }
  }, [success, openCode, openCursor]);

  if (success) {
    // エディタを開くオプションが指定されている場合は簡易表示
    if (openCode || openCursor) {
      let worktreePath: string;

      try {
        const parsed = JSON.parse(success);
        worktreePath = parsed.path;
      } catch {
        worktreePath = success;
      }

      const editorName = openCode ? 'VS Code' : 'Cursor';

      return (
        <Box>
          <Text color="green">
            ✓ Worktree created and opened in {editorName}: {worktreePath}
          </Text>
        </Box>
      );
    }

    let worktreePath: string;
    let actions: string[] = [];

    try {
      const parsed = JSON.parse(success);
      worktreePath = parsed.path;
      actions = parsed.actions || [];
    } catch {
      // 後方互換性のため、文字列の場合はそのままパスとして扱う
      worktreePath = success;
    }

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
            {worktreePath}
          </Text>
          {actions.length > 0 && (
            <Box flexDirection="column" marginTop={1}>
              <Text color="white">Actions:</Text>
              {actions.map((action, index) => (
                <Text key={index} color="yellow">
                  • {action}
                </Text>
              ))}
            </Box>
          )}
          <Box marginTop={1}>
            <Text color="gray">
              Use <Text color="cyan">cd &quot;{worktreePath}&quot;</Text> to
              navigate
            </Text>
          </Box>
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
