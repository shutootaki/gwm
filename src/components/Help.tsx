import React from 'react';
import { Text, Box } from 'ink';

interface HelpProps {
  command?: string;
}

const GlobalHelp: React.FC = () => (
  <Box flexDirection="column">
    <Text>gwm: A CLI tool to streamline your git worktree workflow.</Text>
    <Text />
    <Text bold>USAGE:</Text>
    <Text> gwm &lt;command&gt; [arguments] [options]</Text>
    <Text />
    <Text bold>AVAILABLE COMMANDS:</Text>
    <Text> add Create a new worktree</Text>
    <Text> go Go to a worktree directory or open it in an editor</Text>
    <Text> list (ls) List all worktrees for the current project</Text>
    <Text> pull-main Update the main branch worktree</Text>
    <Text> remove (rm) Remove one or more worktrees</Text>
    <Text> clean Clean up safe-to-delete worktrees</Text>
    <Text> completion Manage shell completion</Text>
    <Text> help Show help for gwm or a specific command</Text>
    <Text />
    <Text>
      Use &quot;gwm help &lt;command&gt;&quot; for more information about a
      specific command.
    </Text>
  </Box>
);

const AddHelp: React.FC = () => (
  <Box flexDirection="column">
    <Text>Create a new worktree from a new, existing, or remote branch.</Text>
    <Text>
      If no branch name is provided, an interactive UI will be launched.
    </Text>
    <Text />
    <Text bold>USAGE:</Text>
    <Text> gwm add [branch_name] [options]</Text>
    <Text />
    <Text bold>ARGUMENTS:</Text>
    <Text>
      {' '}
      branch_name Name of the branch for the new worktree. (optional)
    </Text>
    <Text />
    <Text bold>OPTIONS:</Text>
    <Text>
      {' '}
      -r, --remote Fetch from remote and create a worktree from a remote branch
    </Text>
    <Text>
      {' '}
      --from &lt;base_branch&gt; Specify the base branch to branch off from.
    </Text>
    <Text>
      {' '}
      Defaults to the first branch in &apos;main_branches&apos; config (e.g.,
      &quot;main&quot;).
    </Text>
    <Text> --code Open the new worktree in VS Code after creation</Text>
    <Text> --cursor Open the new worktree in Cursor after creation</Text>
    <Text>
      {' '}
      --cd Output the path to the new worktree (for shell integration)
    </Text>
    <Text />
    <Text bold>EXAMPLES:</Text>
    <Text> # Interactively create a new branch and worktree</Text>
    <Text> $ gwm add</Text>
    <Text />
    <Text>
      {' '}
      # Create a worktree for a new branch &apos;feature/user-profile&apos; from
      the main branch
    </Text>
    <Text> $ gwm add feature/user-profile</Text>
    <Text />
    <Text>
      {' '}
      # Create a worktree from a remote branch for a pull request review
    </Text>
    <Text> $ gwm add a-pull-request-branch -r</Text>
    <Text />
    <Text>
      {' '}
      # Create a new branch from &apos;develop&apos; instead of the default main
      branch
    </Text>
    <Text> $ gwm add hotfix/urgent-patch --from develop</Text>
  </Box>
);

const ListHelp: React.FC = () => (
  <Box flexDirection="column">
    <Text>
      List all worktrees for the current project with their status indicators.
    </Text>
    <Text />
    <Text bold>USAGE:</Text>
    <Text> gwm list</Text>
    <Text> gwm ls</Text>
    <Text />
    <Text bold>STATUS INDICATORS:</Text>
    <Text> * ACTIVE - Current worktree (yellow)</Text>
    <Text> M MAIN - Base main worktree (cyan)</Text>
    <Text> - OTHER - All other worktrees (white)</Text>
    <Text />
    <Text bold>EXAMPLES:</Text>
    <Text> # List all worktrees</Text>
    <Text> $ gwm list</Text>
    <Text> $ gwm ls</Text>
  </Box>
);

const RemoveHelp: React.FC = () => (
  <Box flexDirection="column">
    <Text>Remove one or more worktrees with search selection.</Text>
    <Text>If no query is provided, an interactive UI will be launched.</Text>
    <Text />
    <Text bold>USAGE:</Text>
    <Text> gwm remove [query] [options]</Text>
    <Text> gwm rm [query] [options]</Text>
    <Text />
    <Text bold>ARGUMENTS:</Text>
    <Text> query Search query to filter worktrees (optional)</Text>
    <Text />
    <Text bold>OPTIONS:</Text>
    <Text> -f, --force Force remove worktree without confirmation</Text>
    <Text />
    <Text bold>EXAMPLES:</Text>
    <Text> # Interactively select worktrees to remove</Text>
    <Text> $ gwm remove</Text>
    <Text />
    <Text> # Remove worktrees matching &apos;feature&apos;</Text>
    <Text> $ gwm remove feature</Text>
    <Text />
    <Text> # Force remove without confirmation</Text>
    <Text> $ gwm remove old-branch --force</Text>
  </Box>
);

const GoHelp: React.FC = () => (
  <Box flexDirection="column">
    <Text>Go to a worktree directory or open it in an editor.</Text>
    <Text>If no query is provided, an interactive UI will be launched.</Text>
    <Text />
    <Text bold>USAGE:</Text>
    <Text> gwm go [query] [options]</Text>
    <Text />
    <Text bold>ARGUMENTS:</Text>
    <Text> query Search query to filter worktrees (optional)</Text>
    <Text />
    <Text bold>OPTIONS:</Text>
    <Text> -c, --code Open selected worktree in VS Code</Text>
    <Text> --cursor Open selected worktree in Cursor</Text>
    <Text />
    <Text bold>EXAMPLES:</Text>
    <Text> # Interactively select a worktree to navigate to</Text>
    <Text> $ gwm go</Text>
    <Text />
    <Text> # Navigate to worktree matching &apos;feature&apos;</Text>
    <Text> $ gwm go feature</Text>
    <Text />
    <Text> # Open worktree in VS Code</Text>
    <Text> $ gwm go main --code</Text>
    <Text />
    <Text color="gray">
      Note: Use with shell function wgo() for directory navigation
    </Text>
  </Box>
);

const PullMainHelp: React.FC = () => (
  <Box flexDirection="column">
    <Text>Update the main branch worktree to the latest state.</Text>
    <Text>
      This command pulls the latest changes in all main branch worktrees.
    </Text>
    <Text />
    <Text bold>USAGE:</Text>
    <Text> gwm pull-main</Text>
    <Text />
    <Text bold>EXAMPLES:</Text>
    <Text> # Update main branch worktrees</Text>
    <Text> $ gwm pull-main</Text>
  </Box>
);

const HelpHelp: React.FC = () => (
  <Box flexDirection="column">
    <Text>Show help information for gwm or a specific command.</Text>
    <Text />
    <Text bold>USAGE:</Text>
    <Text> gwm help [command]</Text>
    <Text> gwm --help</Text>
    <Text> gwm -h</Text>
    <Text> gwm &lt;command&gt; --help</Text>
    <Text> gwm &lt;command&gt; -h</Text>
    <Text />
    <Text bold>ARGUMENTS:</Text>
    <Text> command Show help for a specific command (optional)</Text>
    <Text />
    <Text bold>EXAMPLES:</Text>
    <Text> # Show general help</Text>
    <Text> $ gwm help</Text>
    <Text />
    <Text> # Show help for the add command</Text>
    <Text> $ gwm help add</Text>
    <Text> $ gwm add --help</Text>
  </Box>
);

const CleanHelp: React.FC = () => (
  <Box flexDirection="column">
    <Text>Detect and remove worktrees that are safe to delete.</Text>
    <Text />
    <Text bold>USAGE:</Text>
    <Text> gwm clean [-n] [--force]</Text>
    <Text />
    <Text bold>OPTIONS:</Text>
    <Text> -n, --dry-run Show candidates only, do not delete</Text>
    <Text> --force Skip confirmation and delete immediately</Text>
    <Text />
    <Text bold>EXAMPLES:</Text>
    <Text> # Preview cleanable worktrees</Text>
    <Text> $ gwm clean -n</Text>
    <Text />
    <Text> # Force clean without confirmation (CI etc.)</Text>
    <Text> $ gwm clean --force</Text>
  </Box>
);

const CompletionHelp: React.FC = () => (
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
    <Text />
    <Text bold>EXAMPLES:</Text>
    <Text> # Install zsh completion</Text>
    <Text> $ gwm completion install --shell zsh</Text>
    <Text />
    <Text> # Install Kiro/Fig completion</Text>
    <Text> $ gwm completion install --kiro</Text>
    <Text />
    <Text> # Check installation status</Text>
    <Text> $ gwm completion status</Text>
    <Text />
    <Text> # Output zsh completion script</Text>
    <Text> $ gwm completion script --shell zsh</Text>
  </Box>
);

const UnknownCommandHelp: React.FC<{ command: string }> = ({ command }) => (
  <Box flexDirection="column">
    <Text color="red">Unknown command: {command}</Text>
    <Text />
    <Text>
      Available commands: add, list (ls), remove (rm), clean, go, pull-main,
      completion, help
    </Text>
    <Text />
    <Text>Use &quot;gwm help&quot; to see all available commands.</Text>
  </Box>
);

const commandHelpComponents: { [key: string]: React.FC } = {
  add: AddHelp,
  list: ListHelp,
  ls: ListHelp,
  remove: RemoveHelp,
  rm: RemoveHelp,
  clean: CleanHelp,
  completion: CompletionHelp,
  go: GoHelp,
  'pull-main': PullMainHelp,
  help: HelpHelp,
};

export const Help: React.FC<HelpProps> = ({ command }) => {
  if (!command) {
    return <GlobalHelp />;
  }

  const CommandHelpComponent = commandHelpComponents[command];

  if (CommandHelpComponent) {
    return <CommandHelpComponent />;
  }

  return <UnknownCommandHelp command={command} />;
};
