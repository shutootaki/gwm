#!/usr/bin/env node

import { ConfigTest } from './components/ConfigTest.js';
import { render } from 'ink';
import { SelectTest } from './components/SelectTest.js';
import { Welcome } from './components/Welcome.js';
import { Help } from './components/Help.js';
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
  parseHelpArgs,
  isHelpRequested,
} from './utils/index.js';

const App: React.FC = () => {
  const args = process.argv.slice(2);
  const command = args[0];

  // ヘルプオプションのチェック
  if (isHelpRequested(args, command)) {
    if (command === 'help') {
      // `gwm help [command]` の場合
      const { command: helpCommand } = parseHelpArgs(args);
      return <Help command={helpCommand} />;
    } else {
      // `gwm <command> --help` の場合
      return <Help command={command} />;
    }
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
      const { query, force, cleanBranch } = parseRemoveArgs(args);
      return (
        <WorktreeRemove query={query} force={force} cleanBranch={cleanBranch} />
      );
    }
    case 'go': {
      const { query, openCode, openCursor } = parseGoArgs(args);
      return (
        <WorktreeGo query={query} openCode={openCode} openCursor={openCursor} />
      );
    }
    case 'clean': {
      const { dryRun, force } = parseCleanArgs(args);
      return <WorktreeClean dryRun={dryRun} force={force} />;
    }
    case 'pull-main': {
      parsePullMainArgs(args); // 将来の拡張用
      return <WorktreePullMain />;
    }
    case 'help': {
      const { command: helpCommand } = parseHelpArgs(args);
      return <Help command={helpCommand} />;
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
