import React, { useEffect, useState } from 'react';
import { Text, Box } from 'ink';
import {
  pullMainBranch,
  PullResult,
  formatErrorForDisplay,
} from '../utils/index.js';

export const WorktreePullMain: React.FC = () => {
  const [results, setResults] = useState<PullResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const executePull = async () => {
      try {
        setLoading(true);
        const pullResults = await pullMainBranch();
        setResults(pullResults);
      } catch (err) {
        setError(formatErrorForDisplay(err));
      } finally {
        setLoading(false);
      }
    };

    executePull();
  }, []);

  if (loading) {
    return (
      <Box>
        <Text>Updating main branch worktrees...</Text>
      </Box>
    );
  }

  if (error) {
    return (
      <Box>
        <Text color="red">❌ Error: {error}</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      <Text color="green">✅ Finished updating main branches</Text>
      <Text></Text>
      {results.map((result, index) => (
        <Box key={index} flexDirection="column" marginBottom={1}>
          <Text>
            <Text color={result.success ? 'green' : 'red'}>
              {result.success ? '✅' : '❌'}
            </Text>
            <Text> {result.branch}</Text>
            <Text color="gray"> ({result.path})</Text>
          </Text>
          {result.message && (
            <Box marginLeft={2}>
              <Text color="gray">{result.message}</Text>
            </Box>
          )}
        </Box>
      ))}
    </Box>
  );
};
