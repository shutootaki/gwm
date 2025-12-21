#!/usr/bin/env npx tsx
/**
 * Homebrew formula SHA256 updater
 *
 * Usage: npx tsx scripts/update-homebrew-sha.ts [version]
 *        If version is omitted, uses version from package.json
 *
 * Security measures:
 * - Downloads tarball via HTTPS from npm registry
 * - Calculates SHA256 hash locally
 * - Verifies hash by re-downloading and comparing
 * - Uses native crypto module (no external dependencies)
 */

import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';

const FORMULA_PATH = 'homebrew/Formula/gwm.rb';
const NPM_REGISTRY = 'https://registry.npmjs.org';

interface PackageJson {
  version: string;
}

/**
 * Calculate SHA256 hash of a buffer
 */
function sha256(data: Buffer): string {
  return createHash('sha256').update(data).digest('hex');
}

/**
 * Fetch binary data from URL (HTTPS only)
 */
async function fetchBinary(url: string): Promise<Buffer> {
  // Validate HTTPS
  if (!url.startsWith('https://')) {
    throw new Error(`Security error: URL must use HTTPS: ${url}`);
  }

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(
      `Failed to fetch ${url}: ${response.status} ${response.statusText}`
    );
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Get version from package.json
 */
function getPackageVersion(): string {
  const packageJson: PackageJson = JSON.parse(
    readFileSync('package.json', 'utf-8')
  );
  return packageJson.version;
}

/**
 * Construct npm tarball URL
 */
function getTarballUrl(version: string): string {
  // npm registry URL format: https://registry.npmjs.org/@scope/package/-/package-version.tgz
  return `${NPM_REGISTRY}/@shutootaki/gwm/-/gwm-${version}.tgz`;
}

/**
 * Update formula file with new URL and SHA256
 */
function updateFormula(
  _version: string,
  tarballUrl: string,
  hash: string
): void {
  let formula = readFileSync(FORMULA_PATH, 'utf-8');

  // Update URL
  formula = formula.replace(
    /url "https:\/\/registry\.npmjs\.org\/@shutootaki\/gwm\/-\/gwm-[\d.]+\.tgz"/,
    `url "${tarballUrl}"`
  );

  // Update SHA256 (handles both placeholder and existing hash)
  formula = formula.replace(
    /sha256 "(PLACEHOLDER_SHA256|[a-f0-9]{64})"/,
    `sha256 "${hash}"`
  );

  writeFileSync(FORMULA_PATH, formula);
}

async function main(): Promise<void> {
  // Get version from argument or package.json
  const version = process.argv[2] || getPackageVersion();
  console.log(`Updating Homebrew formula for version: ${version}`);

  const tarballUrl = getTarballUrl(version);
  console.log(`Fetching tarball from: ${tarballUrl}`);

  // Download and calculate hash
  let tarball: Buffer;
  try {
    tarball = await fetchBinary(tarballUrl);
  } catch (error) {
    console.error(
      `Error: Failed to download tarball. Is version ${version} published to npm?`
    );
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }

  const hash = sha256(tarball);
  console.log(`Calculated SHA256: ${hash}`);

  // Verify by re-downloading
  console.log('Verifying checksum...');
  const verifyTarball = await fetchBinary(tarballUrl);
  const verifyHash = sha256(verifyTarball);

  if (hash !== verifyHash) {
    console.error('Error: SHA256 verification failed! Checksums do not match.');
    console.error(`  First download:  ${hash}`);
    console.error(`  Second download: ${verifyHash}`);
    process.exit(1);
  }
  console.log('Checksum verified successfully');

  // Update formula
  console.log(`Updating formula file: ${FORMULA_PATH}`);
  updateFormula(version, tarballUrl, hash);

  console.log('');
  console.log('Formula updated successfully!');
  console.log(`  Version: ${version}`);
  console.log(`  URL: ${tarballUrl}`);
  console.log(`  SHA256: ${hash}`);
  console.log('');
  console.log('Next steps:');
  console.log('  1. Commit changes to this repository');
  console.log('  2. Copy Formula/gwm.rb to homebrew-formulae repository');
  console.log('  3. Users can install with: brew install shutootaki/formulae/gwm');
}

main().catch((error) => {
  console.error('Unexpected error:', error);
  process.exit(1);
});
