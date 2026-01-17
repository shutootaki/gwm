import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getRemoteBranchesWithInfo } from '../src/utils/git/index.js';

// execSyncをモック化
vi.mock('child_process', () => ({
  execSync: vi.fn(),
  exec: vi.fn(),
}));

// execAsyncをモック化
vi.mock('../src/utils/shell.js', () => ({
  execAsync: vi.fn(),
  escapeShellArg: vi.fn((arg) => arg),
}));

import { execAsync } from '../src/utils/shell.js';

const mockExecAsync = vi.mocked(execAsync);

describe('getRemoteBranchesWithInfo', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should parse remote branches with info correctly', async () => {
    const gitOutput = `origin/main|2024-01-15T10:30:00+09:00|John Doe|Initial commit
origin/feature/user-auth|2024-01-14T15:45:30+09:00|Jane Smith|feat: add user authentication
origin/fix/bug-123|2024-01-13T09:20:15+09:00|Bob Johnson|fix: resolve issue #123
origin/HEAD|2024-01-15T10:30:00+09:00|John Doe|Initial commit`;

    mockExecAsync.mockResolvedValue({
      stdout: gitOutput,
      stderr: '',
    });

    const result = await getRemoteBranchesWithInfo();

    expect(mockExecAsync).toHaveBeenCalledWith(
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

  it('should handle empty output', async () => {
    mockExecAsync.mockResolvedValue({
      stdout: '',
      stderr: '',
    });

    const result = await getRemoteBranchesWithInfo();

    expect(result).toEqual([]);
  });

  it('should handle branches with missing fields', async () => {
    const gitOutput = `origin/branch1|||
origin/branch2|2024-01-15T10:30:00+09:00||
origin/branch3||Alice|Some commit`;

    mockExecAsync.mockResolvedValue({
      stdout: gitOutput,
      stderr: '',
    });

    const result = await getRemoteBranchesWithInfo();

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

  it('should handle branches with pipe characters in commit message', async () => {
    const gitOutput = `origin/feature|2024-01-15T10:30:00+09:00|Developer|feat: add feature|with pipe`;

    mockExecAsync.mockResolvedValue({
      stdout: gitOutput,
      stderr: '',
    });

    const result = await getRemoteBranchesWithInfo();

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      name: 'feature',
      fullName: 'origin/feature',
      lastCommitDate: '2024-01-15T10:30:00+09:00',
      lastCommitterName: 'Developer',
      lastCommitMessage: 'feat: add feature', // パイプ以降は切り捨てられる
    });
  });

  it('should filter out HEAD references', async () => {
    const gitOutput = `origin/main|2024-01-15T10:30:00+09:00|John Doe|Initial commit
origin/HEAD|2024-01-15T10:30:00+09:00|John Doe|Initial commit
upstream/HEAD|2024-01-15T10:30:00+09:00|John Doe|Initial commit`;

    mockExecAsync.mockResolvedValue({
      stdout: gitOutput,
      stderr: '',
    });

    const result = await getRemoteBranchesWithInfo();

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('main');
  });

  it('should handle newlines in output correctly', async () => {
    const gitOutput = `origin/branch1|2024-01-15T10:30:00+09:00|Dev1|Commit 1

origin/branch2|2024-01-14T10:30:00+09:00|Dev2|Commit 2


`;

    mockExecAsync.mockResolvedValue({
      stdout: gitOutput,
      stderr: '',
    });

    const result = await getRemoteBranchesWithInfo();

    expect(result).toHaveLength(2);
    expect(result[0].name).toBe('branch1');
    expect(result[1].name).toBe('branch2');
  });

  it('should throw error when git command fails', async () => {
    mockExecAsync.mockRejectedValue(new Error('git command failed'));

    await expect(getRemoteBranchesWithInfo()).rejects.toThrow(
      'Failed to get remote branches: git command failed'
    );
  });

  it('should handle non-Error exceptions', async () => {
    mockExecAsync.mockRejectedValue('string error');

    await expect(getRemoteBranchesWithInfo()).rejects.toThrow(
      'Failed to get remote branches: Unknown error'
    );
  });
});
