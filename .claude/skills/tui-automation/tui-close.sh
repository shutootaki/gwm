#!/bin/bash
# セッションを終了
#
# tmuxセッションを強制終了する。
# TUIが終了していない場合でも強制的にセッションを閉じる。
#
# 使用例:
#   ./tui-close.sh

set -euo pipefail

SESSION="${GWM_TUI_SESSION:-gwm-tui-test}"

if tmux has-session -t "$SESSION" 2>/dev/null; then
    tmux kill-session -t "$SESSION"
    echo "Session closed: $SESSION"
else
    echo "Session not found: $SESSION (already closed or never started)"
fi
