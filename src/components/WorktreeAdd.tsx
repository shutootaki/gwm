import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
} from 'react';
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
import { HookConfirmation, type ConfirmChoice } from './ui/HookConfirmation.js';
import { getRemoteBranchesWithInfo } from '../utils/git.js';
import { escapeShellArg, execAsync } from '../utils/shell.js';
import { loadConfigWithSource } from '../config/loader.js';
import {
  verifyTrust,
  trustRepository,
  type TrustStatus,
} from '../trust/index.js';

interface WorktreeAddProps {
  branchName?: string;
  isRemote?: boolean;
  fromBranch?: string;
  openCode?: boolean;
  openCursor?: boolean;
  outputPath?: boolean;
  skipHooks?: boolean;
}

interface RemoteBranch {
  name: string;
  fullName: string;
  lastCommitDate: string;
  lastCommitterName: string;
  lastCommitMessage: string;
}

type ViewMode = 'input' | 'select' | 'loading' | 'hooks' | 'confirm';

/** Pending confirmation information */
interface PendingConfirmation {
  trustStatus: TrustStatus & { status: 'needs-confirmation' };
  branch: string;
  isRemote: boolean;
}

export const WorktreeAdd: React.FC<WorktreeAddProps> = ({
  branchName,
  isRemote = false,
  fromBranch,
  openCode = false,
  openCursor = false,
  outputPath = false,
  skipHooks = false,
}) => {
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [remoteBranches, setRemoteBranches] = useState<RemoteBranch[]>([]);
  const [isRemoteBranchesLoaded, setIsRemoteBranchesLoaded] = useState(false);
  const [pendingConfirmation, setPendingConfirmation] =
    useState<PendingConfirmation | null>(null);

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

  // ローディング時のラベル（状況に応じて変更）
  const [loadingLabel, setLoadingLabel] = useState<string>(
    branchName ? 'Creating worktree...' : 'Fetching remote branches...'
  );

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

  const handleHooksStart = useCallback(() => {
    setViewMode('hooks');
  }, []);

  const { createWorktree } = useWorktree({
    fromBranch,
    openCode,
    openCursor,
    outputPath,
    skipHooks,
    onSuccess: handleSuccess,
    onError: handleError,
    onHooksStart: handleHooksStart,
  });

  // createWorktree の最新参照を保持（useEffect の依存配列から除外するため）
  const createWorktreeRef = useRef(createWorktree);
  useEffect(() => {
    createWorktreeRef.current = createWorktree;
  }, [createWorktree]);

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

  /**
   * worktree作成前に信頼確認を行い、必要に応じて確認UIを表示
   */
  const checkTrustAndCreate = useCallback(
    (branch: string, isRemoteBranch: boolean) => {
      // --skip-hooks が指定されている場合は確認不要
      if (skipHooks) {
        createWorktree(branch, isRemoteBranch);
        return;
      }

      // 設定をソース情報付きで読み込む
      const { config, hasProjectHooks, repoRoot } = loadConfigWithSource();

      // リポジトリ外の場合は確認不要
      if (!repoRoot) {
        createWorktree(branch, isRemoteBranch);
        return;
      }

      // 信頼状態を確認
      const trustStatus = verifyTrust(repoRoot, config, hasProjectHooks);

      if (trustStatus.status === 'needs-confirmation') {
        // 確認が必要 → 確認UIを表示
        setPendingConfirmation({
          trustStatus,
          branch,
          isRemote: isRemoteBranch,
        });
        setViewMode('confirm');
      } else {
        // 信頼済み or hooks なし → そのまま作成
        createWorktree(branch, isRemoteBranch);
      }
    },
    [skipHooks, createWorktree]
  );

  /**
   * 確認UIでの選択を処理
   */
  const handleConfirmChoice = useCallback(
    (choice: ConfirmChoice) => {
      if (!pendingConfirmation) return;

      const {
        trustStatus,
        branch,
        isRemote: isRemoteBranch,
      } = pendingConfirmation;

      if (choice === 'cancel') {
        // キャンセル → 中止
        setError('Operation cancelled.');
        setPendingConfirmation(null);
        return;
      }

      if (choice === 'trust') {
        // 信頼してキャッシュに保存
        const { repoRoot } = loadConfigWithSource();
        if (repoRoot) {
          trustRepository(
            repoRoot,
            trustStatus.configPath,
            trustStatus.configHash,
            trustStatus.commands
          );
        }
      }

      // trust または once → worktree作成を続行
      setPendingConfirmation(null);
      setViewMode('loading');
      setLoadingLabel('Creating worktree...');
      createWorktree(branch, isRemoteBranch);
    },
    [pendingConfirmation, createWorktree]
  );

  const handleBranchSelect = (item: SelectItem) => {
    checkTrustAndCreate(item.value, true);
  };

  const handleBranchInput = (branchName: string) => {
    checkTrustAndCreate(branchName, false);
  };

  const handleCancel = () => {
    setError('Operation cancelled');
  };

  const handleModeSwitch = () => {
    if (viewMode === 'input') {
      // 新規ブランチ入力からリモートブランチ選択に切り替え
      if (!isRemoteBranchesLoaded) {
        setLoadingLabel('Fetching remote branches...');
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

  // checkTrustAndCreate の最新参照を保持（useEffect から参照するため）
  const checkTrustAndCreateRef = useRef(checkTrustAndCreate);
  useEffect(() => {
    checkTrustAndCreateRef.current = checkTrustAndCreate;
  }, [checkTrustAndCreate]);

  // 初回マウント時の処理
  useEffect(() => {
    if (branchName) {
      // 引数でブランチ名が指定された場合、信頼確認してから作成
      checkTrustAndCreateRef.current(branchName, isRemote);
    } else if (isRemote) {
      // -r フラグが指定された場合、リモートブランチ選択モードに
      setLoadingLabel('Fetching remote branches...');
      setViewMode('loading');
      fetchRemoteBranches();
    } else {
      // 引数なしの場合、デフォルトで新規ブランチ入力モード
      setViewMode('input');
    }
  }, [branchName, isRemote]);

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
      let actions: string[] = [];

      try {
        const parsed = JSON.parse(success);
        worktreePath = parsed.path;
        actions = parsed.actions || [];
      } catch {
        worktreePath = success;
      }

      const editorName = openCode ? 'VS Code' : 'Cursor';

      // hooks実行結果をフィルタリング（Executedまたはfailedを含むもの）
      const hookMessages = actions.filter(
        (a) => a.includes('hook') || a.includes('Hook')
      );

      const messages = [
        `✓ ${worktreePath}`,
        ...hookMessages.map((h) => `• ${h}`),
      ];

      return (
        <Notice
          variant="success"
          title={`Worktree created and opened in ${editorName}`}
          messages={messages}
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

    // worktreePathからブランチ名を抽出（最後のディレクトリ名）
    const branchName = worktreePath.split('/').pop() || '';

    return (
      <Notice
        variant="success"
        title="Worktree created successfully!"
        messages={[
          `Location: ${worktreePath}`,
          ...actions.map((a) => `• ${a}`),
          'To navigate to the created worktree, run:',
          `  $ gwm go ${branchName}`,
          `  $ cd "${worktreePath}"`,
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

  // viewMode === 'confirm'（確認UI表示）
  if (viewMode === 'confirm' && pendingConfirmation) {
    return (
      <HookConfirmation
        reason={pendingConfirmation.trustStatus.reason}
        commands={pendingConfirmation.trustStatus.commands}
        onChoice={handleConfirmChoice}
      />
    );
  }

  // viewMode === 'hooks'（フック実行中はスピナーを非表示）
  if (viewMode === 'hooks') {
    return null;
  }

  // viewMode === 'loading'
  return <LoadingSpinner label={loadingLabel} />;
};
