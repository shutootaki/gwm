---
name: tui-automation
description: |
  gwm-rustのTUIを自動操作して動作確認を行うスキル。
  tmux経由でTUIを起動し、キー操作と画面キャプチャを行う。
  以下の場合に自動的に適用される:
  - 「TUIをテストして」「UI確認して」と依頼された場合
  - インタラクティブコマンド（add, go, remove, clean）の動作確認
  - 画面描画やキー操作の検証
  - 「画面を操作して」「TUIの動作確認」と依頼された場合
allowed-tools: Bash, Read
---

# gwm-rust TUI自動操作スキル

tmux経由でgwm-rustのTUIを自動操作し、動作確認を行う。

## 前提条件

- tmuxがインストールされていること
- Python3がインストールされていること
- gwm-rustがビルド済みであること（`./target/debug/gwm`）

## スクリプト一覧

すべてのスクリプトは `.claude/skills/tui-automation/` ディレクトリにあります。

| スクリプト | 説明 | 使用例 |
|-----------|------|--------|
| `tui-start.sh <cmd>` | TUIセッション開始 | `./tui-start.sh "./target/debug/gwm add"` |
| `tui-state.sh` | 画面状態取得（JSON） | `./tui-state.sh` |
| `tui-capture.sh` | 画面キャプチャ（生テキスト） | `./tui-capture.sh` |
| `tui-send.sh <keys>` | キー送信 | `./tui-send.sh j Enter` |
| `tui-type.sh <text>` | 文字列入力 | `./tui-type.sh "feature/test"` |
| `tui-close.sh` | セッション終了 | `./tui-close.sh` |

## 操作フロー

1. `tui-start.sh`でTUIを起動
2. `tui-state.sh`で状態を確認（トークン効率重視）
3. 状態に応じて`tui-send.sh`または`tui-type.sh`で操作
4. 2-3を繰り返し
5. `tui-close.sh`で終了

## キーマッピング

| 操作 | キー | tmux表記 |
|------|------|----------|
| 下移動 | j / ↓ | `j` / `Down` |
| 上移動 | k / ↑ | `k` / `Up` |
| 選択確定 | Enter | `Enter` |
| キャンセル | Esc / q | `Escape` / `q` |
| 複数選択トグル | Space | `Space` |
| 全選択 | Ctrl+A | `C-a` |
| 全削除 | Ctrl+U | `C-u` |
| 単語削除 | Ctrl+W | `C-w` |
| Ctrl+C | Ctrl+C | `C-c` |
| Backspace | Backspace | `BSpace` |
| Tab | Tab | `Tab` |

## 画面状態タイプ（tui-state.sh出力）

### text_input（テキスト入力）

addコマンドでの新規ブランチ名入力画面。

```json
{
  "type": "text_input",
  "title": "Create new worktree",
  "value": "feature/",
  "error": null,
  "preview": "~/worktrees/gwm/feature-"
}
```

操作: `tui-type.sh`で文字入力、`Enter`で確定、`Escape`でキャンセル

### select_list（選択リスト）

リモートブランチ選択やworktree選択画面。

```json
{
  "type": "select_list",
  "title": "Select remote branch",
  "items": ["feature/auth", "main", "develop"],
  "selected": 0,
  "total": 15,
  "filtered": 3
}
```

操作: `j`/`k`で移動、`Enter`で選択、`Escape`でキャンセル

### confirm（確認ダイアログ）

フック実行確認画面。

```json
{
  "type": "confirm",
  "title": "Run post-create hooks?",
  "selected": "once",
  "commands": ["npm install"]
}
```

操作: `Tab`または矢印キーで選択肢移動、`Enter`で確定

選択肢:
- `trust`: 信頼キャッシュに保存して実行
- `once`: 一度だけ実行
- `cancel`: キャンセル

### multi_select（複数選択）

removeコマンドでの複数worktree選択画面。

```json
{
  "type": "multi_select",
  "title": "Select worktrees to remove",
  "items": [
    {"label": "feature/old", "checked": true},
    {"label": "fix/bug", "checked": false}
  ],
  "selected_count": 1
}
```

操作: `j`/`k`で移動、`Space`でトグル、`Enter`で確定

### loading（ローディング）

```json
{
  "type": "loading",
  "message": "Fetching remote branches..."
}
```

操作: 待機（必要に応じて`Escape`でキャンセル）

### success / error（結果表示）

```json
{"type": "success", "messages": ["✓ Worktree created!", "Path: ~/worktrees/..."]}
{"type": "error", "messages": ["✗ Failed to create worktree"]}
```

操作: 任意キーで終了、または自動終了

## テストシナリオ

### 1. gwm add（新規ブランチ作成）

```bash
SKILL_DIR=".claude/skills/tui-automation"

# 起動
$SKILL_DIR/tui-start.sh "./target/debug/gwm add"

# 状態確認（text_inputを期待）
$SKILL_DIR/tui-state.sh

# ブランチ名入力
$SKILL_DIR/tui-type.sh "feature/test-branch"

# 状態確認（プレビュー表示を確認）
$SKILL_DIR/tui-state.sh

# キャンセルして終了（テストなので実際には作成しない）
$SKILL_DIR/tui-send.sh Escape
$SKILL_DIR/tui-close.sh
```

### 2. gwm add -r（リモートブランチ選択）

```bash
SKILL_DIR=".claude/skills/tui-automation"

# 起動
$SKILL_DIR/tui-start.sh "./target/debug/gwm add -r"

# ローディング待ち
sleep 2
$SKILL_DIR/tui-state.sh

# select_listを確認してから操作
$SKILL_DIR/tui-send.sh j j  # 2つ下に移動

# 状態確認
$SKILL_DIR/tui-state.sh

# キャンセル
$SKILL_DIR/tui-send.sh Escape
$SKILL_DIR/tui-close.sh
```

### 3. gwm go（ワークツリー移動）

```bash
SKILL_DIR=".claude/skills/tui-automation"

$SKILL_DIR/tui-start.sh "./target/debug/gwm go"
$SKILL_DIR/tui-state.sh  # select_listを期待
$SKILL_DIR/tui-send.sh Escape
$SKILL_DIR/tui-close.sh
```

### 4. gwm remove（複数選択削除）

```bash
SKILL_DIR=".claude/skills/tui-automation"

$SKILL_DIR/tui-start.sh "./target/debug/gwm remove"
$SKILL_DIR/tui-state.sh  # multi_selectを期待

# Space で選択トグル（テストではEscでキャンセル）
$SKILL_DIR/tui-send.sh Space j Space
$SKILL_DIR/tui-state.sh

$SKILL_DIR/tui-send.sh Escape
$SKILL_DIR/tui-close.sh
```

## 確認ポイント

各コマンドで以下を確認:

1. **正しい画面タイプが表示されるか**
   - add: `text_input` → `loading`（hooks有の場合）→ `confirm` or `success`
   - add -r: `loading` → `select_list` → ...
   - go: `select_list`
   - remove: `multi_select` → `confirm` → ...

2. **キー操作が正しく反映されるか**
   - j/k で移動（selectedが変化）
   - Enter で確定
   - Escape でキャンセル（should_quit）
   - Space でトグル（checkedが変化）
   - 文字入力でvalueが更新

3. **エラーハンドリング**
   - 不正な入力に対するバリデーションエラー（error フィールド）
   - Git操作失敗時のエラーメッセージ

## トラブルシューティング

| 問題 | 解決策 |
|------|--------|
| セッションが見つからない | `tui-start.sh`を先に実行 |
| Python3がない | `brew install python3` (macOS) |
| tmuxがない | `brew install tmux` (macOS) |
| 画面が空 | sleepを増やして待機時間を延長 |
| JSONパースエラー | `tui-capture.sh`で生出力を確認 |
| キーが効かない | tmuxのプレフィックスキーと競合していないか確認 |

## 注意事項

- 操作後は必ず`tui-state.sh`で状態を確認する
- loadingの場合は適切にsleepを入れる（1-2秒）
- セッション終了を忘れないこと（`tui-close.sh`）
- テストで実際にworktreeを作成しないよう、最後はEscapeでキャンセル
- 環境変数`GWM_TUI_SESSION`でセッション名を変更可能（デフォルト: `gwm-tui-test`）
- 環境変数`GWM_TUI_DELAY`でキー送信間隔を調整可能（デフォルト: `0.1`秒）
