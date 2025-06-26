import React from 'react';
import { Text, Box } from 'ink';

export const Welcome: React.FC = () => {
  return (
    <Box flexDirection="column" padding={1}>
      <Text color="cyan" bold>wtm - Git Worktree Manager</Text>
      <Text></Text>
      <Text>Usage: wtm &lt;command&gt; [options]</Text>
      <Text></Text>
      <Text bold>Commands:</Text>
      <Text>  list, ls                    List all worktrees with status</Text>
      <Text>  create [branch] [-r] [--from branch]  Create new worktree</Text>
      <Text>  remove, rm [query] [-f]     Remove worktrees (interactive)</Text>
      <Text>  clean [-y]                  Clean merged/deleted worktrees</Text>
      <Text>  go [query]                  Navigate to worktree (use with shell function)</Text>
      <Text>  code [query]                Open worktree in VS Code</Text>
      <Text></Text>
      <Text bold>Options:</Text>
      <Text>  -r, --remote                Create from remote branch</Text>
      <Text>  --from &lt;branch&gt;            Specify base branch for new worktree</Text>
      <Text>  -f, --force                 Force remove worktree</Text>
      <Text>  -y, --yes                   Skip confirmation prompts</Text>
      <Text></Text>
      <Text bold>Examples:</Text>
      <Text>  wtm list                    Show all worktrees</Text>
      <Text>  wtm create feature/new-ui   Create worktree from local branch</Text>
      <Text>  wtm create -r origin/main   Create from remote branch</Text>
      <Text>  wtm remove                  Interactive worktree removal</Text>
      <Text>  wtm clean                   Interactive cleanup of old worktrees</Text>
      <Text>  wtm clean -y                Auto-cleanup without confirmation</Text>
      <Text></Text>
      <Text color="gray">Configuration: ~/.config/wtm/config.toml or ~/.wtmrc</Text>
    </Box>
  );
};
