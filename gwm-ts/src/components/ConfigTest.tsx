import React from 'react';
import { Text, Box } from 'ink';
import { loadConfig } from '../config.js';

export const ConfigTest: React.FC = () => {
  const config = loadConfig();

  return (
    <Box flexDirection="column">
      <Text bold color="cyan">
        Configuration:
      </Text>
      <Text>Worktree Base Path: {config.worktree_base_path}</Text>
      <Text>Main Branches: {config.main_branches.join(', ')}</Text>
    </Box>
  );
};
