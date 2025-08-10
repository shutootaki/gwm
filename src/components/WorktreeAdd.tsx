import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { SelectList } from './SelectList.js';
import {
  TextInput,
  validateBranchName,
  generateWorktreePreview,
} from './TextInput.js';
import { SelectItem } from '../types/index.js';
import { formatErrorForDisplay } from '../utils/index.js';
import { useWorktree } from '../hooks/useWorktree.js';
import { LoadingSpinner } from './ui/LoadingSpinner.js';
import { Notice } from './ui/Notice.js';
import { getRemoteBranchesWithInfo } from '../utils/git.js';
import { escapeShellArg, execAsync } from '../utils/shell.js';

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
  lastCommitDate: string;
  lastCommitterName: string;
  lastCommitMessage: string;
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
      const { stdout } = await execAsync('git remote', {
        cwd: process.cwd(),
        encoding: 'utf8',
      });
      const remotes = stdout
        .split('\n')
        .map((r) => r.trim())
        .filter(Boolean);

      const targetRemotes = remotes.includes('origin') ? ['origin'] : remotes;
      for (const remote of targetRemotes) {
        await execAsync(`git fetch --prune ${escapeShellArg(remote)}`, {
          cwd: process.cwd(),
        });
      }

      // リモートブランチの詳細情報を取得
      const branches = await getRemoteBranchesWithInfo();

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

  // remoteBranches の SelectList 用変換をメモ化
  const selectItems: SelectItem[] = useMemo(
    () =>
      remoteBranches.map((branch) => ({
        label: branch.name,
        value: branch.name,
        description: branch.lastCommitMessage,
        metadata: {
          lastCommitDate: branch.lastCommitDate,
          lastCommitterName: branch.lastCommitterName,
          lastCommitMessage: branch.lastCommitMessage,
        },
      })),
    [remoteBranches]
  );

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
        <Notice
          variant="success"
          title={`Worktree created and opened in ${editorName}`}
          messages={`✓ ${worktreePath}`}
        />
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
      <Notice
        variant="success"
        title="Worktree created successfully!"
        messages={[
          `Location: ${worktreePath}`,
          ...actions.map((a) => `• ${a}`),
          `Use: cd "${worktreePath}" to navigate`,
        ]}
      />
    );
  }

  if (error) {
    return (
      <Notice
        variant="error"
        title="Failed to create worktree"
        messages={[error, 'Branch may already exist or permission issue']}
      />
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
    return (
      <SelectList
        items={selectItems}
        onSelect={handleBranchSelect}
        onCancel={handleCancel}
        title="Create worktree from remote branch"
        placeholder="Search remote branches..."
      />
    );
  }

  // viewMode === 'loading'
  return <LoadingSpinner label="Fetching remote branches..." />;
};
