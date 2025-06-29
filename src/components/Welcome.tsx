import React from 'react';
import { Text, Box } from 'ink';

// 見やすい 2 カラム行
interface RowProps {
  label: string;
  desc: string;
}

const Row: React.FC<RowProps> = ({ label, desc }) => {
  const labelWidth = 32; // ラベルの固定幅
  const paddedLabel = label.padEnd(labelWidth, ' ');
  return (
    <Text>
      <Text color="yellow">{paddedLabel}</Text>
      {desc}
    </Text>
  );
};

export const Welcome: React.FC = () => {
  const commands: RowProps[] = [
    { label: 'list, ls', desc: 'List all worktrees with status' },
    {
      label: 'add [branch] [-r] [--from branch]',
      desc: 'Add new worktree',
    },
    {
      label: 'remove, rm [query] [-f] [--clean-branch <mode>]',
      desc: 'Remove worktrees (interactive)',
    },
    {
      label: 'clean [-n] [--force]',
      desc: 'Clean up safe-to-delete worktrees',
    },
    { label: 'pull-main', desc: 'Update main branch worktree(s)' },
    {
      label: 'go [query] [--code] [--cursor]',
      desc: 'Navigate or open worktree',
    },
    { label: 'help [command]', desc: 'Show help for gwm or specific command' },
  ];

  const options: RowProps[] = [
    { label: '-r, --remote', desc: 'Add from remote branch' },
    { label: '--from <branch>', desc: 'Specify base branch for new worktree' },
    { label: '-f, --force', desc: 'Force remove worktree' },
    {
      label: '-n, --dry-run',
      desc: 'Preview cleanable worktrees',
    },
    {
      label: '--force',
      desc: 'Skip confirmation on clean',
    },
    {
      label: '--clean-branch <mode>',
      desc: 'auto | ask | never (local branch cleanup)',
    },
    { label: '--code', desc: 'Open selected worktree in VS Code' },
    { label: '--cursor', desc: 'Open selected worktree in Cursor' },
  ];

  return (
    <Box flexDirection="column" padding={1}>
      {/* Header */}
      <Box marginBottom={1}>
        <Text color="cyan" bold>
          gwm - Git Worktree Manager
        </Text>
      </Box>

      {/* Usage */}
      <Box marginBottom={1}>
        <Text>
          Usage: <Text color="yellow">gwm &lt;command&gt; [options]</Text>
        </Text>
      </Box>

      {/* Commands */}
      <Box flexDirection="column" marginBottom={1}>
        <Text bold>Commands:</Text>
        {commands.map((row) => (
          <Row key={row.label} {...row} />
        ))}
      </Box>

      {/* Options */}
      <Box flexDirection="column" marginBottom={1}>
        <Text bold>Options:</Text>
        {options.map((row) => (
          <Row key={row.label} {...row} />
        ))}
      </Box>

      {/* Examples */}
      <Box flexDirection="column" marginBottom={1}>
        <Text bold>Examples:</Text>
        <Row label="gwm list" desc="Show all worktrees" />
        <Row
          label="gwm add feature/new-ui"
          desc="Add worktree from local branch"
        />
        <Row label="gwm add -r origin/main" desc="Add from remote branch" />
        <Row label="gwm remove" desc="Interactive worktree removal" />
        <Row label="gwm clean -n" desc="Dry-run clean" />
        <Row
          label="gwm clean --force"
          desc="Force clean without confirmation"
        />
      </Box>

      {/* Config */}
      <Text color="gray">
        Configuration: ~/.config/gwm/config.toml or ~/.gwmrc
      </Text>
    </Box>
  );
};
