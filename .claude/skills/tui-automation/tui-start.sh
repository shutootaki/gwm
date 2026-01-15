#!/bin/bash
# TUIセッションをtmux内で開始
#
# 使用例:
#   ./tui-start.sh "./target/debug/gwm add"
#   ./tui-start.sh "./target/debug/gwm add -r"
#   ./tui-start.sh "./target/debug/gwm go"

set -euo pipefail

SESSION="${GWM_TUI_SESSION:-gwm-tui-test}"
COMMAND="$*"

if [ -z "$COMMAND" ]; then
    echo "Usage: tui-start.sh <command>" >&2
    echo "" >&2
    echo "Examples:" >&2
    echo "  tui-start.sh ./target/debug/gwm add" >&2
    echo "  tui-start.sh ./target/debug/gwm go" >&2
    exit 1
fi

# 既存セッションがあれば終了
tmux kill-session -t "$SESSION" 2>/dev/null || true

# 新規セッション作成（80x24のデフォルトサイズ）
# -d: デタッチモード（バックグラウンド）
# -x/-y: ターミナルサイズ指定
tmux new-session -d -s "$SESSION" -x 80 -y 24

# コマンドを送信して実行
tmux send-keys -t "$SESSION" "$COMMAND" Enter

# 起動待ち（TUIの初期描画完了を待つ）
sleep 0.5

echo "Session started: $SESSION"
echo "Command: $COMMAND"
