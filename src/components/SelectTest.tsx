import React, { useState } from 'react';
import { Text, Box } from 'ink';
import { SelectList, SelectItem } from './SelectList.js';

const testItems: SelectItem[] = [
  { label: 'feature/user-authentication', value: 'feature/user-authentication' },
  { label: 'fix/login-bug', value: 'fix/login-bug' },
  { label: 'feature/api-cache', value: 'feature/api-cache' },
  { label: 'hotfix/security-patch', value: 'hotfix/security-patch' },
  { label: 'feature/new-ui', value: 'feature/new-ui' },
  { label: 'develop', value: 'develop' },
  { label: 'staging', value: 'staging' },
];

export const SelectTest: React.FC = () => {
  const [selected, setSelected] = useState<SelectItem | null>(null);
  const [cancelled, setCancelled] = useState(false);

  if (selected) {
    return (
      <Box>
        <Text color="green">Selected: {selected.label}</Text>
      </Box>
    );
  }

  if (cancelled) {
    return (
      <Box>
        <Text color="red">Cancelled</Text>
      </Box>
    );
  }

  return (
    <SelectList
      items={testItems}
      onSelect={setSelected}
      onCancel={() => setCancelled(true)}
      placeholder="Select a branch:"
    />
  );
};