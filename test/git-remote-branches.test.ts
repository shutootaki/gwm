import { describe, it, expect, vi, beforeEach } from 'vitest';
import { execSync } from 'child_process';
import { getRemoteBranchesWithInfo } from '../src/utils/git/index.js';

// execSyncをモック化
vi.mock('child_process', () => ({
  execSync: vi.fn(),
}));

const mockExecSync = vi.mocked(execSync);

describe('getRemoteBranchesWithInfo', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should parse remote branches with info correctly', () => {
    const gitOutput = `origin/main|2024-01-15T10:30:00+09:00|John Doe|Initial commit
origin/feature/user-auth|2024-01-14T15:45:30+09:00|Jane Smith|feat: add user authentication
origin/fix/bug-123|2024-01-13T09:20:15+09:00|Bob Johnson|fix: resolve issue #123
origin/HEAD|2024-01-15T10:30:00+09:00|John Doe|Initial commit`;

    mockExecSync.mockReturnValue(gitOutput);

    const result = getRemoteBranchesWithInfo();

    expect(mockExecSync).toHaveBeenCalledWith(
      'git for-each-ref refs/remotes --format="%(refname:short)|%(committerdate:iso8601-strict)|%(committername)|%(subject)"',
      {
        cwd: process.cwd(),
        encoding: 'utf8',
      }
    );

    expect(result).toHaveLength(3); // HEADは除外される
    
    expect(result[0]).toEqual({
      name: 'main',
      fullName: 'origin/main',
      lastCommitDate: '2024-01-15T10:30:00+09:00',
      lastCommitterName: 'John Doe',
      lastCommitMessage: 'Initial commit',
    });

    expect(result[1]).toEqual({
      name: 'feature/user-auth',
      fullName: 'origin/feature/user-auth',
      lastCommitDate: '2024-01-14T15:45:30+09:00',
      lastCommitterName: 'Jane Smith',
      lastCommitMessage: 'feat: add user authentication',
    });

    expect(result[2]).toEqual({
      name: 'fix/bug-123',
      fullName: 'origin/fix/bug-123',
      lastCommitDate: '2024-01-13T09:20:15+09:00',
      lastCommitterName: 'Bob Johnson',
      lastCommitMessage: 'fix: resolve issue #123',
    });
  });

  it('should handle empty output', () => {
    mockExecSync.mockReturnValue('');

    const result = getRemoteBranchesWithInfo();

    expect(result).toEqual([]);
  });

  it('should handle branches with missing fields', () => {
    const gitOutput = `origin/branch1|||
origin/branch2|2024-01-15T10:30:00+09:00||
origin/branch3||Alice|Some commit`;

    mockExecSync.mockReturnValue(gitOutput);

    const result = getRemoteBranchesWithInfo();

    expect(result).toHaveLength(3);

    expect(result[0]).toEqual({
      name: 'branch1',
      fullName: 'origin/branch1',
      lastCommitDate: '',
      lastCommitterName: '',
      lastCommitMessage: '',
    });

    expect(result[1]).toEqual({
      name: 'branch2',
      fullName: 'origin/branch2',
      lastCommitDate: '2024-01-15T10:30:00+09:00',
      lastCommitterName: '',
      lastCommitMessage: '',
    });

    expect(result[2]).toEqual({
      name: 'branch3',
      fullName: 'origin/branch3',
      lastCommitDate: '',
      lastCommitterName: 'Alice',
      lastCommitMessage: 'Some commit',
    });
  });

  it('should handle branches with pipe characters in commit message', () => {
    const gitOutput = `origin/feature|2024-01-15T10:30:00+09:00|Developer|feat: add feature|with pipe`;

    mockExecSync.mockReturnValue(gitOutput);

    const result = getRemoteBranchesWithInfo();

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      name: 'feature',
      fullName: 'origin/feature',
      lastCommitDate: '2024-01-15T10:30:00+09:00',
      lastCommitterName: 'Developer',
      lastCommitMessage: 'feat: add feature', // パイプ以降は切り捨てられる
    });
  });

  it('should filter out HEAD references', () => {
    const gitOutput = `origin/main|2024-01-15T10:30:00+09:00|John Doe|Initial commit
origin/HEAD|2024-01-15T10:30:00+09:00|John Doe|Initial commit
upstream/HEAD|2024-01-15T10:30:00+09:00|John Doe|Initial commit`;

    mockExecSync.mockReturnValue(gitOutput);

    const result = getRemoteBranchesWithInfo();

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('main');
  });

  it('should handle newlines in output correctly', () => {
    const gitOutput = `origin/branch1|2024-01-15T10:30:00+09:00|Dev1|Commit 1

origin/branch2|2024-01-14T10:30:00+09:00|Dev2|Commit 2


`;

    mockExecSync.mockReturnValue(gitOutput);

    const result = getRemoteBranchesWithInfo();

    expect(result).toHaveLength(2);
    expect(result[0].name).toBe('branch1');
    expect(result[1].name).toBe('branch2');
  });

  it('should throw error when git command fails', () => {
    mockExecSync.mockImplementation(() => {
      throw new Error('git command failed');
    });

    expect(() => getRemoteBranchesWithInfo()).toThrow(
      'Failed to get remote branches: git command failed'
    );
  });

  it('should handle non-Error exceptions', () => {
    mockExecSync.mockImplementation(() => {
      throw 'string error';
    });

    expect(() => getRemoteBranchesWithInfo()).toThrow(
      'Failed to get remote branches: Unknown error'
    );
  });
});