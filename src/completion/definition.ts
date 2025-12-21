/**
 * 補完定義の単一ソース（Single Source of Truth）
 * 全てのコマンド、オプション、引数の定義を集約
 */

import type { CompletionDefinition } from './types.js';

/**
 * gwm の補完定義
 */
export const completionDefinition: CompletionDefinition = {
  rootName: 'gwm',
  description: 'Git worktree manager CLI',
  globalOptions: [
    {
      names: ['-h', '--help'],
      description: 'Show help information',
      takesValue: false,
    },
  ],
  commands: [
    // list / ls
    {
      name: 'list',
      aliases: ['ls'],
      description: 'List all worktrees for the current project',
      options: [],
      args: [],
    },

    // add
    {
      name: 'add',
      description: 'Create a new worktree',
      options: [
        {
          names: ['-r', '--remote'],
          description: 'Fetch from remote and create from remote branch',
          takesValue: false,
        },
        {
          names: ['--from'],
          description: 'Specify the base branch',
          takesValue: true,
          valueArg: {
            name: 'base_branch',
            description: 'Base branch to create worktree from',
            required: true,
            providers: ['localBranches'],
          },
        },
        {
          names: ['--code'],
          description: 'Open in VS Code after creation',
          takesValue: false,
        },
        {
          names: ['--cursor'],
          description: 'Open in Cursor after creation',
          takesValue: false,
        },
        {
          names: ['--cd'],
          description: 'Output path for shell integration',
          takesValue: false,
        },
      ],
      args: [
        {
          name: 'branch_name',
          description: 'Name of the branch for the new worktree',
          required: false,
          // -r/--remote が指定されている場合は remoteBranchesOrigin を使用
          // この条件分岐はランタイムで処理
        },
      ],
    },

    // go
    {
      name: 'go',
      description: 'Go to a worktree directory',
      options: [
        {
          names: ['-c', '--code'],
          description: 'Open in VS Code',
          takesValue: false,
        },
        {
          names: ['--cursor'],
          description: 'Open in Cursor',
          takesValue: false,
        },
      ],
      args: [
        {
          name: 'query',
          description: 'Search query to filter worktrees',
          required: false,
          providers: ['worktrees'],
        },
      ],
    },

    // remove / rm
    {
      name: 'remove',
      aliases: ['rm'],
      description: 'Remove one or more worktrees',
      options: [
        {
          names: ['-f', '--force'],
          description: 'Force remove without confirmation',
          takesValue: false,
        },
        {
          names: ['--clean-branch'],
          description: 'Branch cleanup mode (auto, ask, never)',
          takesValue: true,
          valueArg: {
            name: 'mode',
            description: 'Cleanup mode',
            required: true,
            staticValues: ['auto', 'ask', 'never'],
          },
        },
      ],
      args: [
        {
          name: 'query',
          description: 'Search query to filter worktrees',
          required: false,
          providers: ['worktrees'],
        },
      ],
    },

    // clean
    {
      name: 'clean',
      description: 'Clean up safe-to-delete worktrees',
      options: [
        {
          names: ['-n', '--dry-run'],
          description: 'Show candidates only, do not delete',
          takesValue: false,
        },
        {
          names: ['--force'],
          description: 'Skip confirmation prompt',
          takesValue: false,
        },
      ],
      args: [],
    },

    // pull-main
    {
      name: 'pull-main',
      description: 'Update main branch worktrees to latest state',
      options: [],
      args: [],
    },

    // help
    {
      name: 'help',
      description: 'Show help for gwm or a specific command',
      options: [],
      args: [
        {
          name: 'command',
          description: 'Command to show help for',
          required: false,
          providers: ['subcommands'],
        },
      ],
    },

    // completion
    {
      name: 'completion',
      description: 'Manage shell completion',
      subcommands: [
        // completion script
        {
          name: 'script',
          description: 'Output completion script to stdout',
          options: [
            {
              names: ['--shell'],
              description: 'Shell type (bash, zsh, fish)',
              takesValue: true,
              valueArg: {
                name: 'shell',
                description: 'Shell type',
                required: true,
                staticValues: ['bash', 'zsh', 'fish'],
              },
            },
          ],
          args: [],
        },

        // completion install
        {
          name: 'install',
          description: 'Install completion for your shell',
          options: [
            {
              names: ['--shell'],
              description: 'Shell type (bash, zsh, fish)',
              takesValue: true,
              valueArg: {
                name: 'shell',
                description: 'Shell type',
                required: false,
                staticValues: ['bash', 'zsh', 'fish'],
              },
            },
            {
              names: ['--kiro'],
              description: 'Install Kiro/Fig completion spec',
              takesValue: false,
            },
            {
              names: ['--dry-run'],
              description: 'Show what would be done without making changes',
              takesValue: false,
            },
            {
              names: ['--modify-rc'],
              description: 'Modify shell rc file (e.g., .zshrc)',
              takesValue: false,
            },
            {
              names: ['--path'],
              description: 'Custom installation path',
              takesValue: true,
              valueArg: {
                name: 'path',
                description: 'Installation directory',
                required: true,
              },
            },
          ],
          args: [],
        },

        // completion uninstall
        {
          name: 'uninstall',
          description: 'Uninstall completion',
          options: [
            {
              names: ['--shell'],
              description: 'Shell type (bash, zsh, fish)',
              takesValue: true,
              valueArg: {
                name: 'shell',
                description: 'Shell type',
                required: false,
                staticValues: ['bash', 'zsh', 'fish'],
              },
            },
            {
              names: ['--kiro'],
              description: 'Uninstall Kiro/Fig completion spec',
              takesValue: false,
            },
            {
              names: ['--all'],
              description: 'Uninstall all completions (bash, zsh, fish, kiro)',
              takesValue: false,
            },
          ],
          args: [],
        },

        // completion status
        {
          name: 'status',
          description: 'Show completion installation status',
          options: [],
          args: [],
        },

        // 隠しコマンド: __complete
        {
          name: '__complete',
          description: 'Internal: Generate completion candidates',
          hidden: true,
          options: [
            {
              names: ['--shell'],
              description: 'Shell type',
              takesValue: true,
              valueArg: {
                name: 'shell',
                required: true,
                staticValues: ['bash', 'zsh', 'fish'],
              },
            },
            {
              names: ['--cword'],
              description: 'Current word index',
              takesValue: true,
              valueArg: {
                name: 'index',
                required: true,
              },
            },
          ],
          args: [],
        },

        // 隠しコマンド: __fig_worktrees
        {
          name: '__fig_worktrees',
          description: 'Internal: Fig worktree candidates',
          hidden: true,
          options: [],
          args: [],
        },

        // 隠しコマンド: __fig_branches_local
        {
          name: '__fig_branches_local',
          description: 'Internal: Fig local branch candidates',
          hidden: true,
          options: [],
          args: [],
        },

        // 隠しコマンド: __fig_branches_remote
        {
          name: '__fig_branches_remote',
          description: 'Internal: Fig remote branch candidates',
          hidden: true,
          options: [],
          args: [],
        },
      ],
    },
  ],
};

/**
 * 全てのコマンド名（別名含む）を取得
 */
export function getAllCommandNames(): string[] {
  const names: string[] = [];
  for (const cmd of completionDefinition.commands) {
    if (!cmd.hidden) {
      names.push(cmd.name);
      if (cmd.aliases) {
        names.push(...cmd.aliases);
      }
    }
  }
  return names;
}

/**
 * コマンド名からコマンド定義を取得
 */
export function findCommand(
  name: string
): import('./types.js').CompletionCommand | undefined {
  for (const cmd of completionDefinition.commands) {
    if (cmd.name === name) {
      return cmd;
    }
    if (cmd.aliases?.includes(name)) {
      return cmd;
    }
  }
  return undefined;
}

/**
 * サブコマンドを検索
 */
export function findSubcommand(
  parentCommand: import('./types.js').CompletionCommand,
  name: string
): import('./types.js').CompletionCommand | undefined {
  if (!parentCommand.subcommands) {
    return undefined;
  }
  for (const sub of parentCommand.subcommands) {
    if (sub.name === name) {
      return sub;
    }
    if (sub.aliases?.includes(name)) {
      return sub;
    }
  }
  return undefined;
}
