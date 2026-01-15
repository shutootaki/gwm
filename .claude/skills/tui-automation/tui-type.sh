#!/bin/bash
# 文字列を入力
#
# tmux send-keys -l でテキストをリテラルとして送信する。
# 特殊キーとして解釈されずにそのまま入力される。
#
# 使用例:
#   ./tui-type.sh "feature/test"
#   ./tui-type.sh "fix-bug-123"

set -euo pipefail

SESSION="${GWM_TUI_SESSION:-gwm-tui-test}"

if ! tmux has-session -t "$SESSION" 2>/dev/null; then
    echo "Error: Session '$SESSION' not found" >&2
    echo "Hint: Run tui-start.sh first" >&2
    exit 1
fi

if [ $# -eq 0 ]; then
    echo "Usage: tui-type.sh <text>" >&2
    echo "" >&2
    echo "Examples:" >&2
    echo "  tui-type.sh \"feature/new-feature\"" >&2
    echo "  tui-type.sh \"fix-bug-123\"" >&2
    exit 1
fi

TEXT="$1"

# -l オプションでリテラルとして送信（特殊キー解釈を無効化）
tmux send-keys -t "$SESSION" -l "$TEXT"

echo "Typed: $TEXT"
