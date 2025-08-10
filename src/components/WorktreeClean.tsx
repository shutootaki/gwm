import React, { useEffect, useState, useRef } from 'react';
import { Box, Text, useInput } from 'ink';
import {
  fetchAndPrune,
  getCleanableWorktrees,
  removeWorktree,
  CleanableWorktree,
} from '../utils/index.js';
import Spinner from 'ink-spinner';
import { WorktreeTable } from './WorktreeTable.js';

interface WorktreeCleanProps {
  dryRun?: boolean;
  force?: boolean;
}

export const WorktreeClean: React.FC<WorktreeCleanProps> = ({
  dryRun = false,
  force = false,
}) => {
  const [loading, setLoading] = useState(true);
  const [cleanables, setCleanables] = useState<CleanableWorktree[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [removing, setRemoving] = useState(false);
  const [success, setSuccess] = useState<string[]>([]);
  const [stage, setStage] = useState<'confirm' | 'done'>('done');

  // すでに削除処理が走っているかを保持するフラグ
  const isProcessing = useRef(false);

  // アンマウント時に処理中フラグをリセット
  useEffect(() => {
    return () => {
      isProcessing.current = false;
    };
  }, []);

  // ローディングフェーズを段階的に追跡
  const [loadingStage, setLoadingStage] = useState<'fetch' | 'scan'>('fetch');

  // 削除進捗
  const [progress, setProgress] = useState<{
    current: number;
    total: number;
    path?: string;
  } | null>(null);

  // レンダリング頻度を抑えるための待機時間(ms)
  const YIELD_INTERVAL = 16; // 約60fps 相当

  useEffect(() => {
    const init = async () => {
      try {
        setLoading(true);
        setLoadingStage('fetch');
        await fetchAndPrune();
        // fetch 完了後にスキャンフェーズへ
        setLoadingStage('scan');
        const list = await getCleanableWorktrees();
        setCleanables(list);
        setLoading(false);

        // --dry-run: 一覧表示のみ
        if (dryRun) {
          setStage('done');
          return;
        }

        // --force: 即削除
        if (force && list.length > 0) {
          await handleRemoveAll(list);
          return;
        }

        // 通常モード: 確認ステージ
        if (list.length === 0) {
          setStage('done');
        } else {
          setStage('confirm');
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        setLoading(false);
      }
    };
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dryRun, force]);

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
      isProcessing.current = false;
      return;
    }

    setRemoving(true);
    setProgress({ current: 0, total: list.length });
    const removed: string[] = [];
    const errs: string[] = [];

    try {
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
        await new Promise((r) => setTimeout(r, YIELD_INTERVAL));
      }

      // 進捗リセット
      setProgress(null);

      if (errs.length > 0) setError(errs.join('\n'));
      if (removed.length > 0) setSuccess(removed);
    } finally {
      // 後片付けを確実に実行
      setRemoving(false);
      setStage('done');
      isProcessing.current = false;
    }
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

  // 確認ステージ
  if (stage === 'confirm') {
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

  // --dry-run モード: 候補一覧のみ表示して終了
  if (dryRun && stage === 'done') {
    return (
      <WorktreeTable
        worktrees={cleanables.map((c) => c.worktree)}
        title={`Found ${cleanables.length} cleanable worktree(s) (dry-run)`}
        footer={
          <Text color="gray">
            No changes will be made. Remove <Text color="cyan">--dry-run</Text>{' '}
            to actually clean.
          </Text>
        }
      />
    );
  }

  // interactive MultiSelectList は削除済みのため、ここには到達しない
  return null;
};
