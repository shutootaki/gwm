import React, { useEffect, useState, useRef } from 'react';
import { Box, Text, useInput } from 'ink';
import {
  fetchAndPrune,
  getCleanableWorktrees,
  removeWorktree,
  CleanableWorktree,
} from '../utils/index.js';
import { MultiSelectList } from './MultiSelectList.js';
import { SelectItem } from '../types/index.js';
import Spinner from 'ink-spinner';

interface WorktreeCleanProps {
  yes?: boolean;
}

export const WorktreeClean: React.FC<WorktreeCleanProps> = ({
  yes = false,
}) => {
  const [loading, setLoading] = useState(true);
  const [cleanables, setCleanables] = useState<CleanableWorktree[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [removing, setRemoving] = useState(false);
  const [success, setSuccess] = useState<string[]>([]);
  const [stage, setStage] = useState<'list' | 'confirm' | 'done'>('list');

  // すでに削除処理が走っているかを保持するフラグ
  const isProcessing = useRef(false);

  // ローディングフェーズを段階的に追跡
  const [loadingStage, setLoadingStage] = useState<'fetch' | 'scan'>('fetch');

  // 削除進捗
  const [progress, setProgress] = useState<{
    current: number;
    total: number;
    path?: string;
  } | null>(null);

  useEffect(() => {
    const init = async () => {
      try {
        setLoading(true);
        setLoadingStage('fetch');
        fetchAndPrune();
        // fetch 完了後にスキャンフェーズへ
        setLoadingStage('scan');
        const list = await getCleanableWorktrees();
        setCleanables(list);
        setLoading(false);

        // --yes オプション時は確認ステージへ直接移行
        if (yes && list.length > 0) {
          setStage('confirm');
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        setLoading(false);
      }
    };
    init();
  }, [yes]);

  // 確認プロンプト用
  useInput(
    (input, key) => {
      if (key.escape) {
        setError('Cancelled');
        setStage('done');
        return;
      }
      if (key.return) {
        handleRemoveAll();
      }
    },
    { isActive: stage === 'confirm' }
  );

  const handleRemoveAll = async (targets?: CleanableWorktree[]) => {
    // 多重実行を防止
    if (isProcessing.current) return;
    isProcessing.current = true;

    const list = targets ?? cleanables;
    if (list.length === 0) {
      setError('No worktrees selected');
      return;
    }

    setRemoving(true);
    setProgress({ current: 0, total: list.length });
    const removed: string[] = [];
    const errs: string[] = [];
    for (let i = 0; i < list.length; i++) {
      const item = list[i];
      setProgress({
        current: i + 1,
        total: list.length,
        path: item.worktree.path,
      });
      try {
        removeWorktree(item.worktree.path, true);
        removed.push(item.worktree.path);
      } catch (e) {
        errs.push(
          `${item.worktree.path}: ${e instanceof Error ? e.message : String(e)}`
        );
      }

      // レンダリングのためにイベントループを解放
      // eslint-disable-next-line no-await-in-loop
      await new Promise((r) => setTimeout(r, 0));
    }

    // 進捗リセット
    setProgress(null);

    if (errs.length > 0) setError(errs.join('\n'));
    if (removed.length > 0) setSuccess(removed);
    setRemoving(false);
    setStage('done');
    isProcessing.current = false;
  };

  const handleConfirmSelected = async (selected: SelectItem[]) => {
    const targets = cleanables.filter((c) =>
      selected.some((s) => s.value === c.worktree.path)
    );
    await handleRemoveAll(targets);
  };

  const handleCancel = () => {
    setError('Cancelled');
    setStage('done');
  };

  // --------------- RENDERING -----------------
  if (loading) {
    const msg =
      loadingStage === 'fetch'
        ? 'Fetching remote status (git fetch --prune)…'
        : 'Analyzing worktrees…';
    return (
      <Box>
        <Text>
          <Text color="cyan">
            <Spinner type="dots" />{' '}
          </Text>
          {msg}
        </Text>
      </Box>
    );
  }

  if (removing) {
    if (progress) {
      return (
        <Box>
          <Text>
            <Text color="cyan">
              <Spinner type="dots" />{' '}
            </Text>
            {`Removing (${progress.current}/${progress.total}) ${progress.path}`}
          </Text>
        </Box>
      );
    }
    return (
      <Box>
        <Text>
          <Text color="cyan">
            <Spinner type="dots" />{' '}
          </Text>
          Removing worktrees...
        </Text>
      </Box>
    );
  }

  if (success.length > 0) {
    return (
      <Box flexDirection="column">
        <Text color="green" bold>
          ✓ Successfully cleaned {success.length} worktree(s):
        </Text>
        {success.map((p) => (
          <Text key={p}> {p}</Text>
        ))}
        {error && <Text color="red">Some errors occurred:\n{error}</Text>}
      </Box>
    );
  }

  if (error && stage === 'done') {
    return (
      <Box>
        <Text color="red">✗ Error: {error}</Text>
      </Box>
    );
  }

  if (cleanables.length === 0) {
    return (
      <Box>
        <Text>No cleanable worktrees found.</Text>
      </Box>
    );
  }

  // --yes オプション: 確認ステージ
  if (stage === 'confirm' && yes) {
    return (
      <Box flexDirection="column">
        <Text color="yellow" bold>
          Found {cleanables.length} cleanable worktree(s):
        </Text>
        {cleanables.map((c) => (
          <Text key={c.worktree.path}>
            • {c.worktree.branch.padEnd(30)} {c.worktree.path}
          </Text>
        ))}
        <Box marginTop={1} flexDirection="column">
          <Text color="cyan">
            Press Enter to delete all listed worktrees, or Esc to cancel.
          </Text>
        </Box>
      </Box>
    );
  }

  // 通常対話モード
  const items: SelectItem[] = cleanables.map((c) => {
    const reasonText =
      c.reason === 'remote_deleted'
        ? 'Remote branch deleted'
        : `Merged into ${c.mergedIntoBranch ?? 'main'}`;
    return {
      label: `${c.worktree.branch.padEnd(30)} ${c.worktree.path} → ${reasonText}`,
      value: c.worktree.path,
    };
  });

  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text color="yellow">
          Found {cleanables.length} cleanable worktree(s):
        </Text>
      </Box>
      <MultiSelectList
        items={items}
        onConfirm={handleConfirmSelected}
        onCancel={handleCancel}
        placeholder="Select worktrees to clean (Space to toggle)"
      />
    </Box>
  );
};
