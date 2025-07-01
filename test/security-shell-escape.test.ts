import { describe, it, expect } from 'vitest';
import { escapeShellArg } from '../src/utils/shell.js';

describe('escapeShellArg security tests', () => {
  it('should escape single quotes', () => {
    const malicious = "'; rm -rf /; echo '";
    const escaped = escapeShellArg(malicious);
    // eslint-disable-next-line no-useless-escape
    expect(escaped).toBe("''\\'\'; rm -rf /; echo '\\'''");
  });

  it('should handle command substitution attempts', () => {
    const malicious = '$(rm -rf /)';
    const escaped = escapeShellArg(malicious);
    expect(escaped).toBe("'$(rm -rf /)'");
  });

  it('should handle backtick command substitution', () => {
    const malicious = '`rm -rf /`';
    const escaped = escapeShellArg(malicious);
    expect(escaped).toBe("'`rm -rf /`'");
  });

  it('should handle dollar sign variables', () => {
    const malicious = '$PATH';
    const escaped = escapeShellArg(malicious);
    expect(escaped).toBe("'$PATH'");
  });

  it('should handle newlines', () => {
    const malicious = 'test\nrm -rf /';
    const escaped = escapeShellArg(malicious);
    expect(escaped).toBe("'test\nrm -rf /'");
  });

  it('should handle semicolons', () => {
    const malicious = 'test; rm -rf /';
    const escaped = escapeShellArg(malicious);
    expect(escaped).toBe("'test; rm -rf /'");
  });

  it('should handle pipes', () => {
    const malicious = 'test | rm -rf /';
    const escaped = escapeShellArg(malicious);
    expect(escaped).toBe("'test | rm -rf /'");
  });

  it('should handle ampersands', () => {
    const malicious = 'test && rm -rf /';
    const escaped = escapeShellArg(malicious);
    expect(escaped).toBe("'test && rm -rf /'");
  });

  it('should handle redirections', () => {
    const malicious = 'test > /etc/passwd';
    const escaped = escapeShellArg(malicious);
    expect(escaped).toBe("'test > /etc/passwd'");
  });

  it('should handle complex injection attempt', () => {
    const malicious = "'; echo 'pwned' > /tmp/pwned; '";
    const escaped = escapeShellArg(malicious);
    // eslint-disable-next-line no-useless-escape
    expect(escaped).toBe("''\\'\'; echo '\\''pwned'\\'' > /tmp/pwned; '\\'''");
  });

  it('should handle empty string', () => {
    const empty = '';
    const escaped = escapeShellArg(empty);
    expect(escaped).toBe("''");
  });

  it('should handle normal branch names', () => {
    const normal = 'feature/user-authentication';
    const escaped = escapeShellArg(normal);
    expect(escaped).toBe("'feature/user-authentication'");
  });

  it('should handle branch names with special chars', () => {
    const branch = 'feature/user-auth-v2.0';
    const escaped = escapeShellArg(branch);
    expect(escaped).toBe("'feature/user-auth-v2.0'");
  });

  it('should handle paths with spaces', () => {
    const path = '/Users/test user/My Documents/project';
    const escaped = escapeShellArg(path);
    expect(escaped).toBe("'/Users/test user/My Documents/project'");
  });

  it('should handle unicode characters', () => {
    const unicode = 'ブランチ名';
    const escaped = escapeShellArg(unicode);
    expect(escaped).toBe("'ブランチ名'");
  });
});
