import React from 'react';
import { Notice } from './Notice.js';
import { ProgressSpinner } from './ProgressSpinner.js';

/** Progress information */
export interface Progress {
  current: number;
  total: number;
  detail?: string;
}

/** Idle state (renders nothing) */
interface IdleState {
  status: 'idle';
}

/** Loading state */
interface LoadingState {
  status: 'loading';
  message?: string;
  progress?: Progress;
}

/** Success state */
interface SuccessState {
  status: 'success';
  title?: string;
  messages?: string | string[];
}

/** Error state */
interface ErrorState {
  status: 'error';
  title?: string;
  message?: string;
  helpText?: string | string[];
}

/** Operation result state (discriminated union) */
export type OperationResultProps =
  | IdleState
  | LoadingState
  | SuccessState
  | ErrorState;

/** Normalize messages to array */
const normalizeMessages = (
  messages?: string | string[],
  ...extra: (string | string[] | undefined)[]
): string[] | undefined => {
  const result: string[] = [];

  if (messages) {
    result.push(...(Array.isArray(messages) ? messages : [messages]));
  }

  for (const e of extra) {
    if (e) {
      result.push(...(Array.isArray(e) ? e : [e]));
    }
  }

  return result.length > 0 ? result : undefined;
};

/**
 * 操作結果の統一表示コンポーネント
 *
 * 使用例:
 *   <OperationResult status="idle" />
 *
 *   <OperationResult status="loading" message="Processing..." />
 *
 *   <OperationResult
 *     status="success"
 *     title="Operation completed!"
 *     messages={['File created', 'Changes applied']}
 *   />
 *
 *   <OperationResult
 *     status="error"
 *     title="Failed to process"
 *     message="Permission denied"
 *     helpText="Check file permissions"
 *   />
 */
export const OperationResult: React.FC<OperationResultProps> = (props) => {
  switch (props.status) {
    case 'idle':
      return null;

    case 'loading':
      return (
        <ProgressSpinner
          label={props.message ?? 'Processing...'}
          progress={props.progress}
          color="cyan"
        />
      );

    case 'success':
      return (
        <Notice
          variant="success"
          title={props.title ?? 'Success!'}
          messages={normalizeMessages(props.messages)}
        />
      );

    case 'error':
      return (
        <Notice
          variant="error"
          title={props.title ?? 'Error'}
          messages={normalizeMessages(props.message, props.helpText)}
        />
      );
  }
};
