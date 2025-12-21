# typed: strict
# frozen_string_literal: true

# Homebrew formula for gwm - Git Worktree Manager
# Repository: https://github.com/shutootaki/homebrew-formulae
#
# Security considerations:
# - SHA256 checksum verification for package integrity
# - HTTPS-only downloads from npm registry
# - Pinned version (no HEAD install)
# - Sandboxed build process (Homebrew default)
# - Minimal dependencies (node only)
#
# Installation: brew install shutootaki/formulae/gwm

class Gwm < Formula
  desc "Interactive Git worktree manager with terminal UI"
  homepage "https://github.com/shutootaki/gwm"
  # NOTE: Update URL and SHA256 when releasing new versions
  # Run: scripts/update-homebrew-sha.sh <version>
  url "https://registry.npmjs.org/@shutootaki/gwm/-/gwm-0.1.5.tgz"
  sha256 "PLACEHOLDER_SHA256"
  license "MIT"

  # Dependency: Node.js 18+ (use latest LTS)
  depends_on "node"

  def install
    # Install npm package to libexec (isolated from system)
    system "npm", "install", *std_npm_args
    bin.install_symlink Dir["#{libexec}/bin/*"]

    # Install shell completion scripts
    # These are pre-generated during npm build and included in the package
    bash_completion.install "#{libexec}/lib/node_modules/@shutootaki/gwm/dist/completions/gwm.bash" => "gwm"
    zsh_completion.install "#{libexec}/lib/node_modules/@shutootaki/gwm/dist/completions/_gwm"
    fish_completion.install "#{libexec}/lib/node_modules/@shutootaki/gwm/dist/completions/gwm.fish"
  end

  def caveats
    <<~EOS
      Shell completions have been installed automatically.

      For zsh users, ensure your ~/.zshrc includes:
        autoload -Uz compinit && compinit

      For bash users on macOS, you may need to add to ~/.bash_profile:
        [[ -r "$(brew --prefix)/etc/profile.d/bash_completion.sh" ]] && \\
          source "$(brew --prefix)/etc/profile.d/bash_completion.sh"
    EOS
  end

  test do
    # Verify basic functionality without requiring a git repository
    output = shell_output("#{bin}/gwm help 2>&1", 0)
    assert_match "gwm", output
    assert_match "worktree", output

    # Verify completion scripts are installed
    assert_predicate bash_completion/"gwm", :exist?
    assert_predicate zsh_completion/"_gwm", :exist?
    assert_predicate fish_completion/"gwm.fish", :exist?
  end
end
