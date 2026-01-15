#!/bin/bash
# キーを送信
#
# tmux send-keysで指定したキーをTUIに送信する。
# 複数のキーを指定すると順番に送信される。
#
# 使用例:
#   ./tui-send.sh j          # 下移動（vim style）
#   ./tui-send.sh k          # 上移動（vim style）
#   ./tui-send.sh Enter      # 選択確定
#   ./tui-send.sh Escape     # キャンセル
#   ./tui-send.sh Space      # トグル選択
#   ./tui-send.sh C-c        # Ctrl+C
#   ./tui-send.sh j j Enter  # 2回下移動して確定
#
# 特殊キー一覧:
#   Enter, Escape, Tab, Space, BSpace (Backspace)
#   Up, Down, Left, Right
#   C-a (Ctrl+A), C-c (Ctrl+C), C-d (Ctrl+D), etc.

set -euo pipefail

SESSION="${GWM_TUI_SESSION:-gwm-tui-test}"
DELAY="${GWM_TUI_DELAY:-0.1}"

if ! tmux has-session -t "$SESSION" 2>/dev/null; then
    echo "Error: Session '$SESSION' not found" >&2
    echo "Hint: Run tui-start.sh first" >&2
    exit 1
fi

if [ $# -eq 0 ]; then
    echo "Usage: tui-send.sh <key> [key...]" >&2
    echo "" >&2
    echo "Examples:" >&2
    echo "  tui-send.sh j          # Down (vim style)" >&2
    echo "  tui-send.sh Enter      # Confirm" >&2
    echo "  tui-send.sh Escape     # Cancel" >&2
    echo "  tui-send.sh Space      # Toggle selection" >&2
    echo "  tui-send.sh C-c        # Ctrl+C" >&2
    echo "" >&2
    echo "Special keys: Enter, Escape, Tab, Space, BSpace, Up, Down, Left, Right" >&2
    exit 1
fi

for key in "$@"; do
    tmux send-keys -t "$SESSION" "$key"
    sleep "$DELAY"
done

echo "Sent: $*"
