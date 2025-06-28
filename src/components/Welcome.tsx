import React from 'react';
import { Text, Box } from 'ink';

export const Welcome: React.FC = () => {
  return (
    <Box flexDirection="column" padding={1}>
      <Text color="cyan" bold>
        gwm - Git Worktree Manager
      </Text>
      <Text></Text>
      <Text>Usage: gwm &lt;command&gt; [options]</Text>
      <Text></Text>
      <Text bold>Commands:</Text>
      <Text> list, ls List all worktrees with status</Text>
      <Text> add [branch] [-r] [--from branch] Add new worktree</Text>
      <Text> remove, rm [query] [-f] Remove worktrees (interactive)</Text>
      <Text> clean [-y] Clean merged/deleted worktrees</Text>
      <Text> go [query] Navigate to worktree</Text>
      <Text></Text>
      <Text bold>Options:</Text>
      <Text> -r, --remote Add from remote branch</Text>
      <Text> --from &lt;branch&gt; Specify base branch for new worktree</Text>
      <Text> -f, --force Force remove worktree</Text>
      <Text> -y, --yes Skip confirmation prompts</Text>
      <Text></Text>
      <Text bold>Examples:</Text>
      <Text> gwm list Show all worktrees</Text>
      <Text> gwm add feature/new-ui Add worktree from local branch</Text>
      <Text> gwm add -r origin/main Add from remote branch</Text>
      <Text> gwm remove Interactive worktree removal</Text>
      <Text> gwm clean Interactive cleanup of old worktrees</Text>
      <Text> gwm clean -y Auto-cleanup without confirmation</Text>
      <Text></Text>
      <Text color="gray">
        Configuration: ~/.config/gwm/config.toml or ~/.gwmrc
      </Text>
    </Box>
  );
};
