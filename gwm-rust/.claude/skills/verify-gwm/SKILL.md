---
name: verify-gwm
description: |
  gwm-rustのコード変更後に動作確認を行うスキル。
  以下の場合に自動的に適用される:
  - コード変更後の動作確認を依頼された場合
  - gwmの動作テストを依頼された場合
  - TUIの表示確認やUI崩れチェックを依頼された場合
  - 「動作確認して」「テストして」「確認して」と依頼された場合
---

# gwm-rust 動作確認スキル

gwm-rustのコード変更後に、ビルド・コマンド実行・TUI表示を確認する手順。

## 確認フロー

### Step 1: ビルド

```bash
cargo build
```

ビルドが失敗した場合は、エラーを報告して終了。

### Step 2: 基本情報確認

```bash
./target/debug/gwm --help
./target/debug/gwm --version
./target/debug/gwm              # 引数なし（ウェルカムメッセージ）
```

### Step 3: helpコマンド確認

```bash
./target/debug/gwm help
./target/debug/gwm help list
./target/debug/gwm help add
./target/debug/gwm help remove
./target/debug/gwm help go
./target/debug/gwm help clean
./target/debug/gwm help pull-main
```

### Step 4: listコマンド

```bash
./target/debug/gwm list
./target/debug/gwm ls          # エイリアス
```

確認ポイント:

- テーブルが正しく描画されているか
- ブランチ名、パス、ステータスが表示されているか
- 列幅が適切に調整されているか

### Step 5: その他の非TUIコマンド

```bash
./target/debug/gwm clean --dry-run
./target/debug/gwm clean -n            # 短縮オプション
./target/debug/gwm pull-main
```

### Step 6: TUI起動確認（手動）

以下はインタラクティブなTUIを起動するため、ユーザーに手動実行を案内する:

**addコマンド:**

```bash
./target/debug/gwm add                 # TUI: 新規ブランチ作成
./target/debug/gwm add -r              # TUI: リモートブランチ選択
./target/debug/gwm add feature/test    # 直接指定
./target/debug/gwm add --from develop  # ベースブランチ指定
```

**goコマンド:**

```bash
./target/debug/gwm go                  # TUI: ワークツリー選択
./target/debug/gwm go main             # 直接指定（クエリ）
```

**removeコマンド:**

```bash
./target/debug/gwm remove              # TUI: 複数選択
./target/debug/gwm rm                  # エイリアス
./target/debug/gwm remove -f           # 強制削除
./target/debug/gwm remove --clean-branch auto  # ブランチ自動削除
```

**cleanコマンド（確認あり）:**

```bash
./target/debug/gwm clean               # 確認プロンプト付き
./target/debug/gwm clean -y            # 確認スキップ
```

### Step 7: エディタ連携確認（任意）

```bash
./target/debug/gwm add --code          # VS Code起動
./target/debug/gwm add --cursor        # Cursor起動
./target/debug/gwm add --cd            # パス出力のみ
./target/debug/gwm go --code           # VS Code起動
./target/debug/gwm go --cursor         # Cursor起動
```

### Step 8: エラーケース確認

```bash
# 存在しないサブコマンド
./target/debug/gwm invalid-command

# Gitリポジトリ外での実行
cd /tmp && /path/to/gwm list

# 無効なオプション
./target/debug/gwm add --invalid-option

# 無効なclean-branchモード
./target/debug/gwm remove --clean-branch invalid
```

確認ポイント:

- エラーメッセージが具体的で分かりやすいか
- 赤色でエラー表示されているか
- 対処法が示されているか

### Step 9: 設定ファイル確認（任意）

設定ファイルがある場合の動作確認:

```bash
# 設定ファイルの場所
cat ~/.config/gwm/config.toml

# 設定が反映されているか確認（worktree_base_path等）
./target/debug/gwm add --cd
```

## TUI表示確認ポイント（ユーザーへの案内事項）

### 共通チェック項目

- **レイアウト**: 枠線、テーブル、リストが正しく描画されているか
- **文字化け**: 日本語や特殊文字が正常に表示されているか
- **色**: ステータス色（緑=成功、赤=エラー、黄=警告）が意図通りか
- **リサイズ**: ターミナルサイズを変更しても崩れないか
- **スクロール**: 項目が多い場合にスクロールが正常に動作するか

### キー操作チェック

- `j`/`k` または `↑`/`↓`: 項目移動
- `Enter`: 選択確定
- `Space`: 複数選択トグル（removeコマンド）
- `q` または `Esc`: キャンセル/終了
- 文字入力: テキストフィールドでの入力

### ウィジェット別チェック

| ウィジェット   | 使用箇所      | 確認ポイント               |
| -------------- | ------------- | -------------------------- |
| テーブル       | list          | 列幅、ヘッダー、行の整列   |
| 選択リスト     | add, go       | カーソル移動、ハイライト   |
| 複数選択リスト | remove        | チェックボックス、選択状態 |
| テキスト入力   | add           | カーソル位置、入力文字表示 |
| 確認ダイアログ | remove, clean | Yes/No選択、メッセージ     |
| スピナー       | add, clean    | アニメーション、メッセージ |
| 通知           | 各コマンド    | 成功/エラーメッセージ、色  |

## 確認結果の報告形式

確認後、以下の形式で結果を報告:

```
## 動作確認結果

### 基本コマンド

| 項目 | 結果 | 備考 |
|------|------|------|
| ビルド | OK/NG | |
| --help | OK/NG | |
| --version | OK/NG | |
| 引数なし実行 | OK/NG | |
| help <cmd> | OK/NG | |

### 各コマンド

| コマンド | 結果 | 備考 |
|---------|------|------|
| list / ls | OK/NG | |
| clean --dry-run | OK/NG | |
| pull-main | OK/NG | |

### エラーケース

| ケース | 結果 | 備考 |
|--------|------|------|
| 不正コマンド | OK/NG | |
| Git外実行 | OK/NG | |
| 不正オプション | OK/NG | |

### TUI手動確認依頼

以下のコマンドを実行して、UI崩れがないか確認してください:

1. `./target/debug/gwm add` - テキスト入力、選択リスト
2. `./target/debug/gwm add -r` - リモートブランチ選択
3. `./target/debug/gwm go` - 選択リスト
4. `./target/debug/gwm remove` - 複数選択リスト、確認ダイアログ
5. `./target/debug/gwm clean` - 確認ダイアログ、スピナー

確認ポイント:
- レイアウト崩れがないか
- キー操作が正常か（j/k, Enter, Space, q）
- リサイズしても崩れないか
```

## 変更箇所に応じた重点確認

変更したモジュールに応じて、重点的に確認すべき項目:

| 変更モジュール | 重点確認項目                         |
| -------------- | ------------------------------------ |
| cli/           | --help、オプションパース、エイリアス |
| config/        | 設定読み込み、デフォルト値           |
| git/           | 各Git操作の結果                      |
| ui/views/      | 該当コマンドのTUI表示                |
| ui/widgets/    | 該当ウィジェットの表示・操作         |
| hooks/         | post_createフック実行                |
| utils/         | ファイルコピー、エディタ起動         |
