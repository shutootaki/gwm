import React, { useState } from 'react';
import { Text, Box, useInput } from 'ink';
import { join } from 'path';
import { loadConfig } from '../config.js';
import { getRepositoryName } from '../utils/git.js';

interface TextInputProps {
  title: string;
  placeholder: string;
  initialValue?: string;
  onSubmit: (value: string) => void;
  onCancel: () => void;
  onModeSwitch?: () => void;
  validate?: (value: string) => string | null;
  preview?: (value: string) => string | null;
}

export const TextInput: React.FC<TextInputProps> = ({
  title,
  placeholder,
  initialValue = '',
  onSubmit,
  onCancel,
  onModeSwitch,
  validate,
  preview,
}) => {
  const [value, setValue] = useState(initialValue);

  const validationError = validate ? validate(value) : null;
  const previewText = preview ? preview(value) : null;
  const canSubmit = value.trim() && !validationError;

  useInput((input, key) => {
    if (key.escape) {
      onCancel();
      return;
    }

    if (key.return) {
      if (canSubmit) {
        onSubmit(value.trim());
      }
      return;
    }

    if (key.tab && onModeSwitch) {
      onModeSwitch();
      return;
    }

    if (key.ctrl && input === 'u') {
      setValue('');
      return;
    }

    if (key.backspace || key.delete) {
      setValue(value.slice(0, -1));
      return;
    }

    if (input && input.length === 1) {
      setValue(value + input);
    }
  });

  return (
    <Box flexDirection="column">
      {/* Title */}
      <Box marginBottom={1}>
        <Text color="cyan" bold>
          {title}
        </Text>
      </Box>

      {/* Input */}
      <Box marginBottom={1}>
        <Box flexDirection="column">
          <Text color="gray">{placeholder}</Text>
          <Box marginTop={0}>
            <Text color="cyan" bold>
              ❯{' '}
            </Text>
            <Text color={validationError ? 'red' : 'white'}>{value}</Text>
            <Text color="cyan">█</Text>
          </Box>
        </Box>
      </Box>

      {/* Validation Error */}
      {validationError && (
        <Box marginBottom={1}>
          <Box
            flexDirection="column"
            borderStyle="single"
            borderColor="red"
            padding={1}
          >
            <Text color="red" bold>
              Invalid input
            </Text>
            <Text color="red">{validationError}</Text>
          </Box>
        </Box>
      )}

      {/* Preview */}
      {previewText && !validationError && value.trim() && (
        <Box marginBottom={1}>
          <Box
            flexDirection="column"
            borderStyle="single"
            borderColor="green"
            padding={1}
          >
            <Text color="green" bold>
              Preview
            </Text>
            <Text color="gray">Worktree will be created at:</Text>
            <Text color="cyan">{previewText}</Text>
          </Box>
        </Box>
      )}

      {/* Help */}
      <Box>
        <Text color="gray">
          <Text color="green">Enter</Text> {canSubmit ? 'create' : 'disabled'} •{' '}
          <Text color="red">Esc</Text> cancel
          {onModeSwitch && (
            <>
              {' '}
              • <Text color="yellow">Tab</Text> browse remote branches
            </>
          )}{' '}
          • <Text color="yellow">Ctrl+U</Text> clear
        </Text>
      </Box>
    </Box>
  );
};

// ブランチ名用のバリデーション関数
export function validateBranchName(branchName: string): string | null {
  if (!branchName.trim()) {
    return 'Branch name cannot be empty';
  }

  // Git ブランチ名の制約をチェック
  const invalidChars = /[~^:?*[\]\\]/;
  if (invalidChars.test(branchName)) {
    return 'Branch name contains invalid characters (~^:?*[]\\)';
  }

  if (branchName.startsWith('.') || branchName.endsWith('.')) {
    return 'Branch name cannot start or end with a dot';
  }

  if (branchName.includes('..')) {
    return 'Branch name cannot contain consecutive dots';
  }

  if (branchName.includes(' ')) {
    return 'Branch name cannot contain spaces';
  }

  if (branchName.length > 50) {
    return 'Branch name is too long (max 50 characters)';
  }

  return null;
}

// ワークツリーパスのプレビュー生成関数
export function generateWorktreePreview(branchName: string): string | null {
  if (!branchName.trim()) {
    return null;
  }

  const config = loadConfig();
  const repoName = getRepositoryName();
  const sanitizedBranch = branchName.replace(/\//g, '-');

  return join(config.worktree_base_path, repoName, sanitizedBranch);
}
