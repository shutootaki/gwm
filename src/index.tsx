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
  parseInitArgs,
  isHelpRequested,
  generateShellIntegrationScript,
} from './utils/index.js';

// Non-interactive command: print shell integration and exit early (avoid Ink rendering)
{
  const args = process.argv.slice(2);
  const command = args[0];
  if (command === 'init' && !isHelpRequested(args, command)) {
    try {
      const { shell } = parseInitArgs(args);
      const script = generateShellIntegrationScript(shell, {
        nodePath: process.execPath,
        scriptPath: process.argv[1] ?? '',
      });
      process.stdout.write(script);
      process.exit(0);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      process.stderr.write(`${message}\n`);
      process.exit(1);
    }
  }
}

const App: React.FC = () => {
  const args = process.argv.slice(2);
  const command = args[0];

  // ヘルプオプションのチェック
  if (isHelpRequested(args, command)) {
    if (command === 'help') {
      // `gwm help [command]` の場合
      const { command: helpCommand } = parseHelpArgs(args);
      return <Help command={helpCommand} />;
    } else if (command === '-h' || command === '--help') {
      // `gwm -h` または `gwm --help` の場合（グローバルヘルプ）
      return <Help />;
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
        skipHooks,
      } = parseAddArgs(args);
      return (
        <WorktreeAdd
          branchName={branchName}
          isRemote={isRemote}
          fromBranch={fromBranch}
          openCode={openCode}
          openCursor={openCursor}
          outputPath={outputPath}
          skipHooks={skipHooks}
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
    case 'init': {
      // init is handled before Ink render
      return <Help command="init" />;
    }
    case 'config':
      return <ConfigTest />;
    case 'select-test':
      return <SelectTest />;
    case undefined:
    case '':
      // 引数なしの場合はウェルカム画面
      return <Welcome />;
    default:
      // 未知のコマンドはエラー表示
      return <Help command={command} />;
  }
};

render(<App />);
