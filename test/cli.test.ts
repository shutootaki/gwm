import { describe, it, expect } from 'vitest';
import { parseCreateArgs, parseRemoveArgs, parseCleanArgs, isHelpRequested } from '../src/utils/cli.js';

// createコマンドの引数解析をテスト
describe('parseCreateArgs', () => {
  // 位置引数からのブランチ名解析をテスト
  it('should parse branch name from positional arguments', () => {
    const args = ['create', 'feature-branch'];
    const result = parseCreateArgs(args);
    
    expect(result).toEqual({
      branchName: 'feature-branch',
      isRemote: false,
      fromBranch: undefined,
    });
  });

  // -rフラグの解析をテスト
  it('should parse remote flag (-r)', () => {
    const args = ['create', 'feature-branch', '-r'];
    const result = parseCreateArgs(args);
    
    expect(result).toEqual({
      branchName: 'feature-branch',
      isRemote: true,
      fromBranch: undefined,
    });
  });

  // --remoteフラグの解析をテスト
  it('should parse remote flag (--remote)', () => {
    const args = ['create', 'feature-branch', '--remote'];
    const result = parseCreateArgs(args);
    
    expect(result).toEqual({
      branchName: 'feature-branch',
      isRemote: true,
      fromBranch: undefined,
    });
  });

  // --fromフラグでのベースブランチ指定の解析をテスト
  it('should parse --from branch option', () => {
    const args = ['create', 'feature-branch', '--from', 'develop'];
    const result = parseCreateArgs(args);
    
    expect(result).toEqual({
      branchName: 'feature-branch',
      isRemote: false,
      fromBranch: 'develop',
    });
  });

  // 複数フラグの組み合わせ解析をテスト
  it('should parse complex combination of flags', () => {
    const args = ['create', 'feature-branch', '-r', '--from', 'develop'];
    const result = parseCreateArgs(args);
    
    expect(result).toEqual({
      branchName: 'feature-branch',
      isRemote: true,
      fromBranch: 'develop',
    });
  });

  // ブランチ名なしのcreateコマンドの処理をテスト
  it('should handle create command without branch name', () => {
    const args = ['create'];
    const result = parseCreateArgs(args);
    
    expect(result).toEqual({
      branchName: undefined,
      isRemote: false,
      fromBranch: undefined,
    });
  });

  // フラグのみのcreateコマンドの処理をテスト
  it('should handle create command with only flags', () => {
    const args = ['create', '-r'];
    const result = parseCreateArgs(args);
    
    expect(result).toEqual({
      branchName: undefined,
      isRemote: true,
      fromBranch: undefined,
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
    const args = ['create', 'branch', '--help'];
    const result = isHelpRequested(args, 'create');
    
    expect(result).toBe(true);
  });
});