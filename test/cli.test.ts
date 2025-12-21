import { describe, it, expect } from 'vitest';
import {
  parseAddArgs,
  parseRemoveArgs,
  parseGoArgs,
  parseHelpArgs,
  isHelpRequested,
} from '../src/utils/cli.js';

// addコマンドの引数解析をテスト
describe('parseAddArgs', () => {
  // 位置引数からのブランチ名解析をテスト
  it('should parse branch name from positional arguments', () => {
    const args = ['add', 'feature-branch'];
    const result = parseAddArgs(args);

    expect(result).toEqual({
      branchName: 'feature-branch',
      isRemote: false,
      fromBranch: undefined,
      openCode: false,
      openCursor: false,
      outputPath: false,
      skipHooks: false,
    });
  });

  // -rフラグの解析をテスト
  it('should parse remote flag (-r)', () => {
    const args = ['add', 'feature-branch', '-r'];
    const result = parseAddArgs(args);

    expect(result).toEqual({
      branchName: 'feature-branch',
      isRemote: true,
      fromBranch: undefined,
      openCode: false,
      openCursor: false,
      outputPath: false,
      skipHooks: false,
    });
  });

  // --remoteフラグの解析をテスト
  it('should parse remote flag (--remote)', () => {
    const args = ['add', 'feature-branch', '--remote'];
    const result = parseAddArgs(args);

    expect(result).toEqual({
      branchName: 'feature-branch',
      isRemote: true,
      fromBranch: undefined,
      openCode: false,
      openCursor: false,
      outputPath: false,
      skipHooks: false,
    });
  });

  // --fromフラグでのベースブランチ指定の解析をテスト
  it('should parse --from branch option', () => {
    const args = ['add', 'feature-branch', '--from', 'develop'];
    const result = parseAddArgs(args);

    expect(result).toEqual({
      branchName: 'feature-branch',
      isRemote: false,
      fromBranch: 'develop',
      openCode: false,
      openCursor: false,
      outputPath: false,
      skipHooks: false,
    });
  });

  // 複数フラグの組み合わせ解析をテスト
  it('should parse complex combination of flags', () => {
    const args = ['add', 'feature-branch', '-r', '--from', 'develop'];
    const result = parseAddArgs(args);

    expect(result).toEqual({
      branchName: 'feature-branch',
      isRemote: true,
      fromBranch: 'develop',
      openCode: false,
      openCursor: false,
      outputPath: false,
      skipHooks: false,
    });
  });

  // ブランチ名なしのcreateコマンドの処理をテスト
  it('should handle add command without branch name', () => {
    const args = ['add'];
    const result = parseAddArgs(args);

    expect(result).toEqual({
      branchName: undefined,
      isRemote: false,
      fromBranch: undefined,
      openCode: false,
      openCursor: false,
      outputPath: false,
      skipHooks: false,
    });
  });

  // フラグのみのcreateコマンドの処理をテスト
  it('should handle add command with only flags', () => {
    const args = ['add', '-r'];
    const result = parseAddArgs(args);

    expect(result).toEqual({
      branchName: undefined,
      isRemote: true,
      fromBranch: undefined,
      openCode: false,
      openCursor: false,
      outputPath: false,
      skipHooks: false,
    });
  });

  it('should parse --code flag', () => {
    const args = ['add', 'feature-branch', '--code'];
    const result = parseAddArgs(args);

    expect(result).toEqual({
      branchName: 'feature-branch',
      isRemote: false,
      fromBranch: undefined,
      openCode: true,
      openCursor: false,
      outputPath: false,
      skipHooks: false,
    });
  });

  it('should parse --cursor flag', () => {
    const args = ['add', 'feature-branch', '--cursor'];
    const result = parseAddArgs(args);

    expect(result).toEqual({
      branchName: 'feature-branch',
      isRemote: false,
      fromBranch: undefined,
      openCode: false,
      openCursor: true,
      outputPath: false,
      skipHooks: false,
    });
  });

  it('should parse --cd flag', () => {
    const args = ['add', 'feature-branch', '--cd'];
    const result = parseAddArgs(args);

    expect(result).toEqual({
      branchName: 'feature-branch',
      isRemote: false,
      fromBranch: undefined,
      openCode: false,
      openCursor: false,
      outputPath: true,
      skipHooks: false,
    });
  });

  it('should parse combination of --code and --cursor flags', () => {
    const args = ['add', 'feature-branch', '--code', '--cursor'];
    const result = parseAddArgs(args);

    expect(result).toEqual({
      branchName: 'feature-branch',
      isRemote: false,
      fromBranch: undefined,
      openCode: true,
      openCursor: true,
      outputPath: false,
      skipHooks: false,
    });
  });
});

// removeコマンドの引数解析をテスト
describe('parseRemoveArgs', () => {
  // 位置引数からのクエリ解析をテスト
  it('should parse query from positional arguments', () => {
    const args = ['remove', 'feature'];
    const result = parseRemoveArgs(args);

    expect(result).toEqual({
      query: 'feature',
      force: false,
    });
  });

  // -fフラグの解析をテスト
  it('should parse force flag (-f)', () => {
    const args = ['remove', 'feature', '-f'];
    const result = parseRemoveArgs(args);

    expect(result).toEqual({
      query: 'feature',
      force: true,
    });
  });

  // --forceフラグの解析をテスト
  it('should parse force flag (--force)', () => {
    const args = ['remove', 'feature', '--force'];
    const result = parseRemoveArgs(args);

    expect(result).toEqual({
      query: 'feature',
      force: true,
    });
  });

  // rmエイリアスの処理をテスト
  it('should handle rm alias', () => {
    const args = ['rm', 'feature', '-f'];
    const result = parseRemoveArgs(args);

    expect(result).toEqual({
      query: 'feature',
      force: true,
    });
  });

  // クエリなしのremoveコマンドの処理をテスト
  it('should handle remove command without query', () => {
    const args = ['remove'];
    const result = parseRemoveArgs(args);

    expect(result).toEqual({
      query: undefined,
      force: false,
    });
  });

  // フラグのみのremoveコマンドの処理をテスト
  it('should handle remove command with only flags', () => {
    const args = ['remove', '--force'];
    const result = parseRemoveArgs(args);

    expect(result).toEqual({
      query: undefined,
      force: true,
    });
  });
});

// goコマンドの引数解析をテスト
describe('parseGoArgs', () => {
  // 位置引数からのクエリ解析をテスト
  it('should parse query from positional arguments', () => {
    const args = ['go', 'feature'];
    const result = parseGoArgs(args);

    expect(result).toEqual({
      query: 'feature',
      openCode: false,
      openCursor: false,
    });
  });

  // -cフラグの解析をテスト
  it('should parse code flag (-c)', () => {
    const args = ['go', 'feature', '-c'];
    const result = parseGoArgs(args);

    expect(result).toEqual({
      query: 'feature',
      openCode: true,
      openCursor: false,
    });
  });

  // --codeフラグの解析をテスト
  it('should parse code flag (--code)', () => {
    const args = ['go', 'feature', '--code'];
    const result = parseGoArgs(args);

    expect(result).toEqual({
      query: 'feature',
      openCode: true,
      openCursor: false,
    });
  });

  // クエリなしでcodeフラグの解析をテスト
  it('should parse code flag without query', () => {
    const args = ['go', '--code'];
    const result = parseGoArgs(args);

    expect(result).toEqual({
      query: undefined,
      openCode: true,
      openCursor: false,
    });
  });

  // クエリなしのgoコマンドの処理をテスト
  it('should handle go command without arguments', () => {
    const args = ['go'];
    const result = parseGoArgs(args);

    expect(result).toEqual({
      query: undefined,
      openCode: false,
      openCursor: false,
    });
  });

  // フラグとクエリの順序をテスト
  it('should handle flag before query', () => {
    const args = ['go', '-c', 'feature'];
    const result = parseGoArgs(args);

    expect(result).toEqual({
      query: 'feature',
      openCode: true,
      openCursor: false,
    });
  });

  // --cursor フラグの解析をテスト
  it('should parse cursor flag (--cursor)', () => {
    const args = ['go', 'bugfix', '--cursor'];
    const result = parseGoArgs(args);

    expect(result).toEqual({
      query: 'bugfix',
      openCode: false,
      openCursor: true,
    });
  });

  // --code と --cursor の組み合わせをテスト
  it('should parse combination of --code and --cursor flags', () => {
    const args = ['go', 'hotfix', '--code', '--cursor'];
    const result = parseGoArgs(args);

    expect(result).toEqual({
      query: 'hotfix',
      openCode: true,
      openCursor: true,
    });
  });

  // フラグのみでクエリなしのケースをテスト
  it('should handle flags only without query', () => {
    const args = ['go', '--cursor', '--code'];
    const result = parseGoArgs(args);

    expect(result).toEqual({
      query: undefined,
      openCode: true,
      openCursor: true,
    });
  });
});

// helpコマンドの引数解析をテスト
describe('parseHelpArgs', () => {
  // 位置引数からのコマンド名解析をテスト
  it('should parse command from positional arguments', () => {
    const args = ['help', 'add'];
    const result = parseHelpArgs(args);

    expect(result).toEqual({
      command: 'add',
    });
  });

  // 複数の引数がある場合の最初の引数取得をテスト
  it('should parse first command when multiple arguments', () => {
    const args = ['help', 'list', 'extra'];
    const result = parseHelpArgs(args);

    expect(result).toEqual({
      command: 'list',
    });
  });

  // コマンド引数なしのhelpコマンドの処理をテスト
  it('should handle help command without arguments', () => {
    const args = ['help'];
    const result = parseHelpArgs(args);

    expect(result).toEqual({
      command: undefined,
    });
  });

  // 各コマンドのヘルプ呼び出しをテスト
  it('should parse help for remove command', () => {
    const args = ['help', 'remove'];
    const result = parseHelpArgs(args);

    expect(result).toEqual({
      command: 'remove',
    });
  });

  // エイリアスコマンドのヘルプ呼び出しをテスト
  it('should parse help for command aliases', () => {
    const args = ['help', 'ls'];
    const result = parseHelpArgs(args);

    expect(result).toEqual({
      command: 'ls',
    });
  });

  // 存在しないコマンドのヘルプ要求をテスト
  it('should parse help for non-existent command', () => {
    const args = ['help', 'unknown-command'];
    const result = parseHelpArgs(args);

    expect(result).toEqual({
      command: 'unknown-command',
    });
  });
});

// ヘルプオプション検出の機能をテスト
describe('isHelpRequested', () => {
  // --helpフラグが存在する場合のtrueリターンをテスト
  it('should return true when --help flag is present', () => {
    const args = ['list', '--help'];
    const result = isHelpRequested(args);

    expect(result).toBe(true);
  });

  // -hフラグが存在する場合のtrueリターンをテスト
  it('should return true when -h flag is present', () => {
    const args = ['list', '-h'];
    const result = isHelpRequested(args);

    expect(result).toBe(true);
  });

  // helpコマンドの場合のtrueリターンをテスト
  it('should return true when command is help', () => {
    const args = ['help'];
    const result = isHelpRequested(args, 'help');

    expect(result).toBe(true);
  });

  // ヘルプフラグ・コマンドがない場合のfalseリターンをテスト
  it('should return false when no help flags or command', () => {
    const args = ['list'];
    const result = isHelpRequested(args, 'list');

    expect(result).toBe(false);
  });

  // 引数なしのhelpコマンドのtrueリターンをテスト
  it('should return true when help command is used without other args', () => {
    const args: string[] = [];
    const result = isHelpRequested(args, 'help');

    expect(result).toBe(true);
  });

  // 他のコマンドと組み合わされたhelpフラグの処理をテスト
  it('should handle mixed case with help flags', () => {
    const args = ['add', 'branch', '--help'];
    const result = isHelpRequested(args, 'add');

    expect(result).toBe(true);
  });
});
