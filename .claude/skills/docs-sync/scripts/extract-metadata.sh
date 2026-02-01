#!/usr/bin/env bash
# docs-sync metadata extractor
# ソースコードからCLIコマンド、設定フィールド、環境変数を抽出する。
# 読み取り専用 — ファイルの変更は一切行わない。

set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")/../../../.." && pwd)"
ARGS_FILE="$PROJECT_ROOT/src/cli/args.rs"
TYPES_FILE="$PROJECT_ROOT/src/config/types.rs"
HELP_FILE="$PROJECT_ROOT/src/ui/views/help.rs"

echo "=== docs-sync metadata extraction ==="
echo "Project root: $PROJECT_ROOT"
echo ""

# --- Section 1: CLI Commands ---
echo "## CLI Commands (from args.rs)"
echo ""
echo "### Commands enum variants:"
awk '/^pub enum Commands/,/^}/' "$ARGS_FILE" | grep -E '///|#\[command|^\s+[A-Z]' | head -30
echo ""

# --- Section 2: Args per command ---
echo "## Command Options (non-hidden args)"
echo ""

for struct in AddArgs RemoveArgs GoArgs CleanArgs ListArgs; do
    echo "### $struct:"
    awk "/^pub struct $struct/,/^}/" "$ARGS_FILE" | \
        grep -E '///|#\[arg|pub \w+' | head -20
    echo ""
done

# --- Section 3: Hidden/deprecated items ---
echo "## Hidden/Deprecated Items"
echo ""
echo "### hide = true:"
grep -n 'hide = true' "$ARGS_FILE" || echo "  (none)"
echo ""
echo "### deprecated mentions:"
grep -n -i 'deprecated' "$ARGS_FILE" || echo "  (none)"
echo ""

# --- Section 4: Config fields ---
echo "## Config Fields (from types.rs)"
echo ""
echo "### Config struct:"
awk '/^pub struct Config/,/^}/' "$TYPES_FILE" | grep 'pub '
echo ""
echo "### CopyIgnoredFilesConfig:"
awk '/^pub struct CopyIgnoredFilesConfig/,/^}/' "$TYPES_FILE" | grep 'pub '
echo ""
echo "### VirtualEnvConfig:"
awk '/^pub struct VirtualEnvConfig/,/^}/' "$TYPES_FILE" | grep 'pub '
echo ""
echo "### HookConfig:"
awk '/^pub struct HookConfig/,/^}/' "$TYPES_FILE" | grep 'pub '
echo ""

# --- Section 5: Default values ---
echo "## Default Values"
echo ""
grep -A3 'fn default_' "$TYPES_FILE" | grep -v '^--$'
echo ""
echo "### virtual_env_defaults constants:"
awk '/mod virtual_env_defaults/,/^}/' "$TYPES_FILE" | grep 'pub const'
echo ""

# --- Section 6: Environment variables ---
echo "## Environment Variables (GWM_*)"
echo ""
grep -rn 'GWM_' "$PROJECT_ROOT/src/" --include='*.rs' | \
    grep -v '#\[cfg(test)\]' | \
    grep -v 'mod tests' | \
    grep -v 'fn test_' | \
    grep -v 'assert' | \
    sort -u
echo ""

# --- Section 7: Help text constants ---
echo "## Help Text Constants (from help.rs)"
echo ""
grep 'pub const' "$HELP_FILE"
echo ""

echo "=== extraction complete ==="
