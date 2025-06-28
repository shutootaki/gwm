import { describe, it, expect } from 'vitest';
import {
  parseAddArgs,
  parseRemoveArgs,
  parseCleanArgs,
  parseGoArgs,
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

// cleanコマンドの引数解析をテスト
describe('parseCleanArgs', () => {
  // -yフラグの解析をテスト
  it('should parse yes flag (-y)', () => {
    const args = ['clean', '-y'];
    const result = parseCleanArgs(args);

    expect(result).toEqual({
      yes: true,
    });
  });

  // --yesフラグの解析をテスト
  it('should parse yes flag (--yes)', () => {
    const args = ['clean', '--yes'];
    const result = parseCleanArgs(args);

    expect(result).toEqual({
      yes: true,
    });
  });

  // フラグなしのcleanコマンドの処理をテスト
  it('should handle clean command without flags', () => {
    const args = ['clean'];
    const result = parseCleanArgs(args);

    expect(result).toEqual({
      yes: false,
    });
  });

  // 複数フラグ指定時のyesフラグ処理をテスト
  it('should handle multiple flags with yes flag', () => {
    const args = ['clean', '-y', '--verbose'];
    const result = parseCleanArgs(args);

    expect(result).toEqual({
      yes: true,
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
    const args = [];
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
