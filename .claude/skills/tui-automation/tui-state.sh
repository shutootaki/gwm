#!/bin/bash
# 画面から構造化データを抽出（gwm-rust専用）
#
# tui-capture.shで取得した生テキストをpythonスクリプトでパースし、
# JSON形式で構造化データを出力する。
# これによりトークン消費を85-95%削減できる。
#
# 出力JSON形式:
#   type: 画面の種類
#   - text_input: テキスト入力画面
#   - select_list: 選択リスト画面
#   - confirm: 確認ダイアログ
#   - loading: ローディング中
#   - success: 成功表示
#   - error: エラー表示
#   - multi_select: 複数選択リスト
#   - table: テーブル表示
#   - help: ヘルプ画面
#   - empty: 空画面
#   - unknown: 不明
#
# 使用例:
#   ./tui-state.sh
#   ./tui-state.sh | jq .type

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SESSION="${GWM_TUI_SESSION:-gwm-tui-test}"

if ! tmux has-session -t "$SESSION" 2>/dev/null; then
    echo '{"type":"error","message":"Session not found. Run tui-start.sh first."}'
    exit 1
fi

# 画面をキャプチャしてPythonでパース
RAW=$(tmux capture-pane -t "$SESSION" -p)

# Python3が利用可能か確認
if ! command -v python3 &> /dev/null; then
    echo '{"type":"error","message":"Python3 is required but not installed."}'
    exit 1
fi

echo "$RAW" | python3 "$SCRIPT_DIR/patterns/gwm.py"
