import React from 'react';
import { Text, Box } from 'ink';

interface HelpProps {
  command?: string;
}

export const Help: React.FC<HelpProps> = ({ command }) => {
  if (command) {
    return renderCommandHelp(command);
  }
  return renderGlobalHelp();
};

const renderGlobalHelp = () => {
  return (
    <Box flexDirection="column">
      <Text>gwm: A CLI tool to streamline your git worktree workflow.</Text>
      <Text></Text>
      <Text bold>USAGE:</Text>
      <Text> gwm &lt;command&gt; [arguments] [options]</Text>
      <Text></Text>
      <Text bold>AVAILABLE COMMANDS:</Text>
      <Text> add Create a new worktree</Text>
      <Text> go Go to a worktree directory or open it in an editor</Text>
      <Text> list (ls) List all worktrees for the current project</Text>
      <Text> pull-main Update the main branch worktree</Text>
      <Text> remove (rm) Remove one or more worktrees</Text>
      <Text> help Show help for gwm or a specific command</Text>
      <Text></Text>
      <Text>
        Use "gwm help &lt;command&gt;" for more information about a specific
        command.
      </Text>
    </Box>
  );
};

const renderCommandHelp = (command: string) => {
  switch (command) {
    case 'add':
      return (
        <Box flexDirection="column">
          <Text>
            Create a new worktree from a new, existing, or remote branch.
          </Text>
          <Text>
            If no branch name is provided, an interactive UI will be launched.
          </Text>
          <Text></Text>
          <Text bold>USAGE:</Text>
          <Text> gwm add [branch_name] [options]</Text>
          <Text></Text>
          <Text bold>ARGUMENTS:</Text>
          <Text>
            {' '}
            branch_name Name of the branch for the new worktree. (optional)
          </Text>
          <Text></Text>
          <Text bold>OPTIONS:</Text>
          <Text>
            {' '}
            -r, --remote Fetch from remote and create a worktree from a remote
            branch
          </Text>
          <Text>
            {' '}
            --from &lt;base_branch&gt; Specify the base branch to branch off
            from.
          </Text>
          <Text>
            {' '}
            Defaults to the first branch in 'main_branches' config (e.g.,
            "main").
          </Text>
          <Text> --code Open the new worktree in VS Code after creation</Text>
          <Text> --cursor Open the new worktree in Cursor after creation</Text>
          <Text>
            {' '}
            --cd Output the path to the new worktree (for shell integration)
          </Text>
          <Text></Text>
          <Text bold>EXAMPLES:</Text>
          <Text> # Interactively create a new branch and worktree</Text>
          <Text> $ gwm add</Text>
          <Text></Text>
          <Text>
            {' '}
            # Create a worktree for a new branch 'feature/user-profile' from the
            main branch
          </Text>
          <Text> $ gwm add feature/user-profile</Text>
          <Text></Text>
          <Text>
            {' '}
            # Create a worktree from a remote branch for a pull request review
          </Text>
          <Text> $ gwm add a-pull-request-branch -r</Text>
          <Text></Text>
          <Text>
            {' '}
            # Create a new branch from 'develop' instead of the default main
            branch
          </Text>
          <Text> $ gwm add hotfix/urgent-patch --from develop</Text>
        </Box>
      );

    case 'list':
    case 'ls':
      return (
        <Box flexDirection="column">
          <Text>
            List all worktrees for the current project with their status
            indicators.
          </Text>
          <Text></Text>
          <Text bold>USAGE:</Text>
          <Text> gwm list</Text>
          <Text> gwm ls</Text>
          <Text></Text>
          <Text bold>STATUS INDICATORS:</Text>
          <Text> * ACTIVE - Current worktree (yellow)</Text>
          <Text> M MAIN - Base main worktree (cyan)</Text>
          <Text> - OTHER - All other worktrees (white)</Text>
          <Text></Text>
          <Text bold>EXAMPLES:</Text>
          <Text> # List all worktrees</Text>
          <Text> $ gwm list</Text>
          <Text> $ gwm ls</Text>
        </Box>
      );

    case 'remove':
    case 'rm':
      return (
        <Box flexDirection="column">
          <Text>Remove one or more worktrees with fuzzy search selection.</Text>
          <Text>
            If no query is provided, an interactive UI will be launched.
          </Text>
          <Text></Text>
          <Text bold>USAGE:</Text>
          <Text> gwm remove [query] [options]</Text>
          <Text> gwm rm [query] [options]</Text>
          <Text></Text>
          <Text bold>ARGUMENTS:</Text>
          <Text> query Search query to filter worktrees (optional)</Text>
          <Text></Text>
          <Text bold>OPTIONS:</Text>
          <Text> -f, --force Force remove worktree without confirmation</Text>
          <Text></Text>
          <Text bold>EXAMPLES:</Text>
          <Text> # Interactively select worktrees to remove</Text>
          <Text> $ gwm remove</Text>
          <Text></Text>
          <Text> # Remove worktrees matching 'feature'</Text>
          <Text> $ gwm remove feature</Text>
          <Text></Text>
          <Text> # Force remove without confirmation</Text>
          <Text> $ gwm remove old-branch --force</Text>
        </Box>
      );

    case 'go':
      return (
        <Box flexDirection="column">
          <Text>Go to a worktree directory or open it in an editor.</Text>
          <Text>
            If no query is provided, an interactive UI will be launched.
          </Text>
          <Text></Text>
          <Text bold>USAGE:</Text>
          <Text> gwm go [query] [options]</Text>
          <Text></Text>
          <Text bold>ARGUMENTS:</Text>
          <Text> query Search query to filter worktrees (optional)</Text>
          <Text></Text>
          <Text bold>OPTIONS:</Text>
          <Text> -c, --code Open selected worktree in VS Code</Text>
          <Text> --cursor Open selected worktree in Cursor</Text>
          <Text></Text>
          <Text bold>EXAMPLES:</Text>
          <Text> # Interactively select a worktree to navigate to</Text>
          <Text> $ gwm go</Text>
          <Text></Text>
          <Text> # Navigate to worktree matching 'feature'</Text>
          <Text> $ gwm go feature</Text>
          <Text></Text>
          <Text> # Open worktree in VS Code</Text>
          <Text> $ gwm go main --code</Text>
          <Text></Text>
          <Text color="gray">
            Note: Use with shell function wgo() for directory navigation
          </Text>
        </Box>
      );

    case 'pull-main':
      return (
        <Box flexDirection="column">
          <Text>Update the main branch worktree to the latest state.</Text>
          <Text>
            This command pulls the latest changes in all main branch worktrees.
          </Text>
          <Text></Text>
          <Text bold>USAGE:</Text>
          <Text> gwm pull-main</Text>
          <Text></Text>
          <Text bold>EXAMPLES:</Text>
          <Text> # Update main branch worktrees</Text>
          <Text> $ gwm pull-main</Text>
        </Box>
      );

    case 'help':
      return (
        <Box flexDirection="column">
          <Text>Show help information for gwm or a specific command.</Text>
          <Text></Text>
          <Text bold>USAGE:</Text>
          <Text> gwm help [command]</Text>
          <Text> gwm --help</Text>
          <Text> gwm -h</Text>
          <Text> gwm &lt;command&gt; --help</Text>
          <Text> gwm &lt;command&gt; -h</Text>
          <Text></Text>
          <Text bold>ARGUMENTS:</Text>
          <Text> command Show help for a specific command (optional)</Text>
          <Text></Text>
          <Text bold>EXAMPLES:</Text>
          <Text> # Show general help</Text>
          <Text> $ gwm help</Text>
          <Text></Text>
          <Text> # Show help for the add command</Text>
          <Text> $ gwm help add</Text>
          <Text> $ gwm add --help</Text>
        </Box>
      );

    default:
      return (
        <Box flexDirection="column">
          <Text color="red">Unknown command: {command}</Text>
          <Text></Text>
          <Text>
            Available commands: add, list (ls), remove (rm), go, pull-main, help
          </Text>
          <Text></Text>
          <Text>Use "gwm help" to see all available commands.</Text>
        </Box>
      );
  }
};
