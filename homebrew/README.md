# Homebrew Tap for gwm

This directory contains the Homebrew formula for [gwm](https://github.com/shutootaki/gwm) - Git Worktree Manager.

## Usage

To use this tap, you need to create a separate repository named `homebrew-formulae` and copy the contents of this directory there.

### For Users

```bash
# Install gwm via Homebrew
brew install shutootaki/formulae/gwm
```

### Shell Completion

Shell completions are installed automatically. After installation:

- **zsh**: Works immediately (ensure `compinit` is called in your `.zshrc`)
- **bash**: May require sourcing bash-completion
- **fish**: Works immediately

## Repository Setup

To publish this formula:

1. Create a new GitHub repository: `shutootaki/homebrew-formulae`

2. Copy the Formula directory:
   ```bash
   cd /path/to/homebrew-formulae
   cp -r /path/to/gwm/homebrew/Formula .
   ```

3. Push to GitHub:
   ```bash
   git add Formula/
   git commit -m "Add gwm formula"
   git push origin main
   ```

## Updating the Formula

When releasing a new version:

1. Publish to npm: `pnpm publish`

2. Update the SHA256 hash:
   ```bash
   pnpm update:homebrew <version>
   # or: npx tsx scripts/update-homebrew-sha.ts <version>
   ```

3. Copy updated formula to homebrew-formulae repository

4. Commit and push

## Security

This formula implements several security measures:

| Measure | Description |
|---------|-------------|
| SHA256 verification | Package integrity is verified using SHA256 checksum |
| HTTPS only | All downloads use HTTPS with TLS 1.2+ |
| Pinned version | No HEAD install; version is always fixed |
| Sandboxed build | Uses Homebrew's sandbox build process |
| Minimal dependencies | Only depends on `node` |
| License verification | MIT license is explicitly declared |

### Checksum Verification

The `update-homebrew-sha.sh` script:
1. Downloads the tarball from npm registry
2. Calculates SHA256 locally
3. Re-downloads and verifies the checksum matches
4. Updates the formula only if verification passes

## Testing

Test the formula locally before publishing:

```bash
# Install from local formula
brew install --build-from-source ./homebrew/Formula/gwm.rb

# Run Homebrew's audit
brew audit --strict ./homebrew/Formula/gwm.rb

# Run tests
brew test gwm
```

## Troubleshooting

### SHA256 Mismatch

If you see a SHA256 mismatch error during installation:
1. The npm package may have been republished (against npm policy)
2. Network issues caused corruption
3. Wait and retry, or report an issue

### Node Version Issues

The formula depends on `node@22`. If you have issues:
```bash
brew install node@22
brew link --overwrite node@22
```
