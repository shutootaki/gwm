// Common error handling utilities

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
      'This directory is not a Git repository. Please run this command inside a Git repository.',
      error
    );
  }

  if (message.includes('no such remote')) {
    return createAppError(
      'git',
      'Remote "origin" not found. Please configure a remote repository.',
      error
    );
  }

  if (message.includes('network') || message.includes('fetch')) {
    return createAppError(
      'network',
      'A network error occurred. Please check your internet connection.',
      error
    );
  }

  if (message.includes('worktree') && message.includes('already exists')) {
    return createAppError(
      'filesystem',
      'This worktree already exists. Please use a different name.',
      error
    );
  }

  if (message.includes('permission denied')) {
    return createAppError(
      'filesystem',
      'File system permission error. Please check directory permissions.',
      error
    );
  }

  return createAppError('git', `Git command error: ${error.message}`, error);
}

export function formatErrorMessage(error: AppError): string {
  return error.message;
}

export function formatErrorForDisplay(error: unknown): string {
  if (error instanceof Error) {
    const appError = handleGitError(error);
    return formatErrorMessage(appError);
  }

  return 'An unknown error occurred';
}
