import { createHash } from 'crypto';
import { readFileSync } from 'fs';

/**
 * Compute the SHA-256 hash of a file
 * @param filePath Absolute path to the file
 * @returns Hash string in hex format
 */
export function computeFileHash(filePath: string): string {
  const content = readFileSync(filePath, 'utf8');
  return createHash('sha256').update(content).digest('hex');
}
