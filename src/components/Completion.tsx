/**
 * gwm completion コマンドのReactコンポーネント
 * install, uninstall, status 等のUI表示を担当
 */

import React, { useEffect, useState } from 'react';
import { Text, Box } from 'ink';
import { Notice } from './ui/Notice.js';
import {
  parseInstallArgs,
  runInstall,
  parseUninstallArgs,
  runUninstall,
  getStatus,
  formatStatus,
  parseScriptArgs,
  runScript,
  type InstallResult,
  type UninstallResult,
} from '../completion/commands/index.js';

interface CompletionProps {
  subCommand?: string;
  args: string[];
}

/**
 * Completion コンポーネント
 */
export const Completion: React.FC<CompletionProps> = ({ subCommand, args }) => {
  switch (subCommand) {
    case 'script':
      return <CompletionScript args={args} />;
    case 'install':
      return <CompletionInstall args={args} />;
    case 'uninstall':
      return <CompletionUninstall args={args} />;
    case 'status':
      return <CompletionStatus />;
    default:
      return <CompletionHelp />;
  }
};

/**
 * script サブコマンド
 */
const CompletionScript: React.FC<{ args: string[] }> = ({ args }) => {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const parsedArgs = parseScriptArgs(args);
    const success = runScript(parsedArgs);
    if (!success) {
      setError('--shell option is required (bash, zsh, or fish)');
    } else {
      process.exit(0);
    }
  }, [args]);

  if (error) {
    return (
      <Notice
        variant="error"
        title="Failed to generate completion script"
        messages={[
          error,
          'Usage: gwm completion script --shell <bash|zsh|fish>',
        ]}
      />
    );
  }

  return null;
};

/**
 * install サブコマンド
 */
const CompletionInstall: React.FC<{ args: string[] }> = ({ args }) => {
  const [result, setResult] = useState<InstallResult | null>(null);

  useEffect(() => {
    const parsedArgs = parseInstallArgs(args);

    // どちらのオプションも指定されていない場合
    if (!parsedArgs.shell && !parsedArgs.kiro) {
      setResult({
        success: false,
        message: '--shell or --kiro option is required',
      });
      return;
    }

    const installResult = runInstall(parsedArgs);
    setResult(installResult);
  }, [args]);

  if (!result) {
    return <Text>Installing...</Text>;
  }

  if (!result.success) {
    return (
      <Notice
        variant="error"
        title="Failed to install completion"
        messages={[
          result.message,
          'Usage: gwm completion install --shell <bash|zsh|fish> [--dry-run] [--modify-rc]',
          '       gwm completion install --kiro [--dry-run]',
        ]}
      />
    );
  }

  return (
    <Notice
      variant="success"
      title="Completion installed successfully!"
      messages={result.message.split('\n').filter(Boolean)}
    />
  );
};

/**
 * uninstall サブコマンド
 */
const CompletionUninstall: React.FC<{ args: string[] }> = ({ args }) => {
  const [result, setResult] = useState<UninstallResult | null>(null);

  useEffect(() => {
    const parsedArgs = parseUninstallArgs(args);

    // いずれのオプションも指定されていない場合
    if (!parsedArgs.shell && !parsedArgs.kiro && !parsedArgs.all) {
      setResult({
        success: false,
        message: '--shell, --kiro, or --all option is required',
      });
      return;
    }

    const uninstallResult = runUninstall(parsedArgs);
    setResult(uninstallResult);
  }, [args]);

  if (!result) {
    return <Text>Uninstalling...</Text>;
  }

  if (!result.success) {
    return (
      <Notice
        variant="error"
        title="Failed to uninstall completion"
        messages={[
          result.message,
          'Usage: gwm completion uninstall --shell <bash|zsh|fish>',
          '       gwm completion uninstall --kiro',
          '       gwm completion uninstall --all',
        ]}
      />
    );
  }

  return (
    <Notice
      variant="success"
      title="Completion uninstalled successfully!"
      messages={result.message.split('\n').filter(Boolean)}
    />
  );
};

/**
 * status サブコマンド
 */
const CompletionStatus: React.FC = () => {
  const statuses = getStatus();
  const formatted = formatStatus(statuses);

  return (
    <Box flexDirection="column">
      {formatted.split('\n').map((line, i) => (
        <Text key={i}>{line}</Text>
      ))}
    </Box>
  );
};

/**
 * ヘルプ表示
 */
const CompletionHelp: React.FC = () => {
  return (
    <Box flexDirection="column">
      <Text>Manage shell completion for gwm.</Text>
      <Text />
      <Text bold>USAGE:</Text>
      <Text> gwm completion &lt;subcommand&gt; [options]</Text>
      <Text />
      <Text bold>SUBCOMMANDS:</Text>
      <Text> script Output completion script to stdout</Text>
      <Text> install Install completion for your shell</Text>
      <Text> uninstall Uninstall completion</Text>
      <Text> status Show completion installation status</Text>
      <Text />
      <Text bold>SCRIPT OPTIONS:</Text>
      <Text> --shell &lt;bash|zsh|fish&gt; Shell type (required)</Text>
      <Text />
      <Text bold>INSTALL OPTIONS:</Text>
      <Text> --shell &lt;bash|zsh|fish&gt; Shell type</Text>
      <Text> --kiro Install Kiro/Fig completion spec</Text>
      <Text> --dry-run Show what would be done</Text>
      <Text> --modify-rc Modify shell rc file</Text>
      <Text> --path &lt;path&gt; Custom installation path</Text>
      <Text />
      <Text bold>UNINSTALL OPTIONS:</Text>
      <Text> --shell &lt;bash|zsh|fish&gt; Shell type</Text>
      <Text> --kiro Uninstall Kiro/Fig completion spec</Text>
      <Text> --all Uninstall all completions (bash, zsh, fish, kiro)</Text>
      <Text />
      <Text bold>EXAMPLES:</Text>
      <Text color="gray"> # Install zsh completion</Text>
      <Text> $ gwm completion install --shell zsh</Text>
      <Text />
      <Text color="gray"> # Install with shell rc modification</Text>
      <Text> $ gwm completion install --shell zsh --modify-rc</Text>
      <Text />
      <Text color="gray"> # Install Kiro/Fig completion</Text>
      <Text> $ gwm completion install --kiro</Text>
      <Text />
      <Text color="gray"> # Check installation status</Text>
      <Text> $ gwm completion status</Text>
      <Text />
      <Text color="gray"> # Output zsh completion script</Text>
      <Text> $ gwm completion script --shell zsh</Text>
    </Box>
  );
};
