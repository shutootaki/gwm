#!/usr/bin/env node

import React from 'react';
import { render } from 'ink';
import { Welcome } from './components/Welcome.js';
import { WorktreeList } from './components/WorktreeList.js';
import { ConfigTest } from './components/ConfigTest.js';
import { SelectTest } from './components/SelectTest.js';
import { WorktreeCreate } from './components/WorktreeCreate.js';
import { WorktreeGo } from './components/WorktreeGo.js';
import { WorktreeCode } from './components/WorktreeCode.js';
import { WorktreeRemove } from './components/WorktreeRemove.js';
import { WorktreeClean } from './components/WorktreeClean.js';
import {
  parseCreateArgs,
  parseRemoveArgs,
  parseCleanArgs,
  isHelpRequested,
} from './utils/index.js';

const App: React.FC = () => {
  const args = process.argv.slice(2);
  const command = args[0];

  // ヘルプオプションのチェック
  if (isHelpRequested(args, command)) {
    return <Welcome />;
  }

  switch (command) {
    case 'list':
    case 'ls':
      return <WorktreeList />;
    case 'create': {
      const { branchName, isRemote, fromBranch } = parseCreateArgs(args);
      return (
        <WorktreeCreate
          branchName={branchName}
          isRemote={isRemote}
          fromBranch={fromBranch}
        />
      );
    }
    case 'remove':
    case 'rm': {
      const { query, force } = parseRemoveArgs(args);
      return <WorktreeRemove query={query} force={force} />;
    }
    case 'go':
      return <WorktreeGo query={args[1]} />;
    case 'code':
      return <WorktreeCode query={args[1]} />;
    case 'clean': {
      const { yes } = parseCleanArgs(args);
      return <WorktreeClean yes={yes} />;
    }
    case 'config':
      return <ConfigTest />;
    case 'select-test':
      return <SelectTest />;
    default:
      return <Welcome />;
  }
};

render(<App />);
