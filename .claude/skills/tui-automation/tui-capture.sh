#!/bin/bash
# 画面をキャプチャ（生テキスト）
#
# tmux capture-paneで現在の画面内容を取得する。
# ANSIエスケープシーケンスは除去済みの状態で出力される。
#
# 使用例:
#   ./tui-capture.sh
#   ./tui-capture.sh | less

set -euo pipefail

SESSION="${GWM_TUI_SESSION:-gwm-tui-test}"

if ! tmux has-session -t "$SESSION" 2>/dev/null; then
    echo "Error: Session '$SESSION' not found" >&2
    echo "Hint: Run tui-start.sh first" >&2
    exit 1
fi

tmux capture-pane -t "$SESSION" -p
