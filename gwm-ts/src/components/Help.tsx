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
    <Text> init Print shell integration script</Text>
    <Text> list (ls) List all worktrees for the current project</Text>
    <Text> pull-main Update the main branch worktree</Text>
    <Text> remove (rm) Remove one or more worktrees</Text>
    <Text> clean Clean up safe-to-delete worktrees</Text>
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
    <Text> --cd Output the path only (default, for shell integration)</Text>
    <Text> --no-cd Show success message instead of path output</Text>
    <Text> --skip-hooks Skip post_create hooks execution</Text>
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
    <Text>
      {' '}
      --clean-branch &lt;mode&gt; Local branch cleanup mode (auto|ask|never)
    </Text>
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
    <Text />
    <Text> # Remove and auto-delete local branch if merged</Text>
    <Text> $ gwm remove --clean-branch auto</Text>
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
  </Box>
);

const InitHelp: React.FC = () => (
  <Box flexDirection="column">
    <Text>Print shell integration script for directory navigation.</Text>
    <Text />
    <Text bold>USAGE:</Text>
    <Text> gwm init &lt;shell&gt;</Text>
    <Text />
    <Text bold>ARGUMENTS:</Text>
    <Text> shell Shell type (bash|zsh|fish)</Text>
    <Text />
    <Text bold>DESCRIPTION:</Text>
    <Text>
      Outputs a shell function that wraps gwm to enable changing the current
      directory for &quot;gwm add&quot; and &quot;gwm go&quot; without breaking
      interactive UI.
    </Text>
    <Text />
    <Text bold>EXAMPLES:</Text>
    <Text> # Zsh</Text>
    <Text> $ eval &quot;$(gwm init zsh)&quot;</Text>
    <Text />
    <Text> # Fish</Text>
    <Text> $ gwm init fish | source</Text>
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

const UnknownCommandHelp: React.FC<{ command: string }> = ({ command }) => (
  <Box flexDirection="column">
    <Text color="red">Unknown command: {command}</Text>
    <Text />
    <Text>
      Available commands: add, list (ls), remove (rm), clean, go, pull-main,
      init, help
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
  go: GoHelp,
  init: InitHelp,
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
