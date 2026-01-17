import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFileSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { computeFileHash } from '../src/trust/hash.js';

describe('computeFileHash', () => {
  const testDir = join(tmpdir(), 'gwm-test-hash');
  const testFile = join(testDir, 'test.txt');

  beforeEach(() => {
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  it('should compute SHA-256 hash of file content', () => {
    writeFileSync(testFile, 'hello world');
    const hash = computeFileHash(testFile);

    // SHA-256 hash is 64 characters hex
    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[a-f0-9]+$/);
    // Known SHA-256 of "hello world"
    expect(hash).toBe(
      'b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9'
    );
  });

  it('should return different hash for different content', () => {
    writeFileSync(testFile, 'content 1');
    const hash1 = computeFileHash(testFile);

    writeFileSync(testFile, 'content 2');
    const hash2 = computeFileHash(testFile);

    expect(hash1).not.toBe(hash2);
  });

  it('should return same hash for same content', () => {
    writeFileSync(testFile, 'same content');
    const hash1 = computeFileHash(testFile);
    const hash2 = computeFileHash(testFile);

    expect(hash1).toBe(hash2);
  });

  it('should throw error for non-existent file', () => {
    expect(() => computeFileHash('/nonexistent/file.txt')).toThrow();
  });
});
