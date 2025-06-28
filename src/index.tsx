#!/usr/bin/env node

import { ConfigTest } from './components/ConfigTest.js';
import { render } from 'ink';
import { SelectTest } from './components/SelectTest.js';
import { Welcome } from './components/Welcome.js';
import { WorktreeAdd } from './components/WorktreeAdd.js';
import { WorktreeClean } from './components/WorktreeClean.js';
import { WorktreeGo } from './components/WorktreeGo.js';
import { WorktreeList } from './components/WorktreeList.js';
import { WorktreeRemove } from './components/WorktreeRemove.js';
import { WorktreePullMain } from './components/WorktreePullMain.js';
import React from 'react';
import {
  parseAddArgs,
  parseRemoveArgs,
  parseCleanArgs,
  parseGoArgs,
  parsePullMainArgs,
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
    case 'add': {
      const {
        branchName,
        isRemote,
        fromBranch,
        openCode,
        openCursor,
        outputPath,
      } = parseAddArgs(args);
      return (
        <WorktreeAdd
          branchName={branchName}
          isRemote={isRemote}
          fromBranch={fromBranch}
          openCode={openCode}
          openCursor={openCursor}
          outputPath={outputPath}
        />
      );
    }
    case 'remove':
    case 'rm': {
      const { query, force } = parseRemoveArgs(args);
      return <WorktreeRemove query={query} force={force} />;
    }
    case 'go': {
      const { query, openCode, openCursor } = parseGoArgs(args);
      return (
        <WorktreeGo query={query} openCode={openCode} openCursor={openCursor} />
      );
    }
    case 'clean': {
      const { yes } = parseCleanArgs(args);
      return <WorktreeClean yes={yes} />;
    }
    case 'pull-main': {
      parsePullMainArgs(args); // 将来の拡張用
      return <WorktreePullMain />;
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
