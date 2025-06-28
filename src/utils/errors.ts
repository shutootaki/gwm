// エラーハンドリング共通ユーティリティ

export interface AppError {
  type: 'git' | 'network' | 'filesystem' | 'validation' | 'unknown';
  message: string;
  originalError?: Error;
}

export function createAppError(
  type: AppError['type'],
  message: string,
  originalError?: Error
): AppError {
  return {
    type,
    message,
    originalError,
  };
}

export function handleGitError(error: Error): AppError {
  const message = error.message.toLowerCase();

  if (message.includes('not a git repository')) {
    return createAppError(
      'git',
      'このディレクトリはGitリポジトリではありません。Gitリポジトリ内で実行してください。',
      error
    );
  }

  if (message.includes('no such remote')) {
    return createAppError(
      'git',
      'リモート "origin" が見つかりません。リモートリポジトリを設定してください。',
      error
    );
  }

  if (message.includes('network') || message.includes('fetch')) {
    return createAppError(
      'network',
      'ネットワークエラーが発生しました。インターネット接続を確認してください。',
      error
    );
  }

  if (message.includes('worktree') && message.includes('already exists')) {
    return createAppError(
      'filesystem',
      'このワークツリーは既に存在します。別の名前を使用してください。',
      error
    );
  }

  if (message.includes('permission denied')) {
    return createAppError(
      'filesystem',
      'ファイルシステムの権限エラーです。ディレクトリの権限を確認してください。',
      error
    );
  }

  return createAppError('git', `Gitコマンドエラー: ${error.message}`, error);
}

export function formatErrorMessage(error: AppError): string {
  return error.message;
}

export function formatErrorForDisplay(error: unknown): string {
  if (error instanceof Error) {
    const appError = handleGitError(error);
    return formatErrorMessage(appError);
  }

  return '不明なエラーが発生しました';
}
