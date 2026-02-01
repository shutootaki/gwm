---
name: docs-sync
description: |
  gwmプロジェクトのドキュメント整合性チェックスキル。
  ソースコード（CLI定義 args.rs、設定型定義 types.rs）とドキュメント
  （help.rs、README.md、README_JA.md）間のドリフトを検出し修正提案を行う。
  以下の場合に使用する:
  - 「ドキュメントを確認して」「ヘルプテキストを確認して」と依頼された場合
  - CLI引数や設定項目を変更した後のドキュメント更新確認
  - リリース前のドキュメント整合性チェック
  - 「READMEを更新して」「docs-sync」と依頼された場合
---

# docs-sync: ドキュメント整合性チェック

ソースコード（SOURCE OF TRUTH）とドキュメント間のドリフトを検出し修正提案する。

## ソースファイルマップ

| ファイル | 役割 |
|---------|------|
| `src/cli/args.rs` | CLI定義（SOURCE OF TRUTH） |
| `src/config/types.rs` | 設定型定義（SOURCE OF TRUTH） |
| `src/ui/views/help.rs` | TUIヘルプテキスト（同期先） |
| `README.md` | 英語ドキュメント（同期先） |
| `README_JA.md` | 日本語ドキュメント（同期先） |

## チェック手順

5つのファイルを読み取り、以下6チェックを順に実施する。
オプションで `scripts/extract-metadata.sh` を先に実行し、機械的抽出結果を補助に使える。

### Check 1: CLI Args → Help Text

args.rsの非hiddenコマンド/オプションがhelp.rsに正確に反映されているか確認する。

1. args.rsから抽出:
   - `Commands` enumの非hiddenバリアント（`hide = true`を除く）
   - 各Args構造体の非hiddenフィールドの `short`/`long`/docコメント
   - コマンドエイリアス（`alias = "..."`）

2. help.rsの各定数（`GLOBAL`, `LIST`, `ADD`, `REMOVE`, `GO`, `CLEAN`, `SYNC`, `HELP`）と比較:
   - 非hiddenオプションの欠落
   - hiddenなのにhelp.rsに残っているオプション
   - short/long形式の不一致

### Check 2: CLI Args → README

READMEのCommand Referenceセクションがargs.rsと一致しているか確認する。

1. Check 1で抽出した非hiddenコマンド/オプション一覧を使用
2. `README.md`の`## Commands`や各コマンドセクションと比較:
   - コマンド一覧テーブルの網羅性
   - 各コマンドのオプション記載の正確性
   - deprecated構文が例に含まれていないか

### Check 3: Config Types → README

types.rsの全設定フィールドがREADMEに正しく記載されているか確認する。

1. types.rsから抽出:
   - `Config`構造体と全ネスト構造体のフィールド名
   - デフォルト値（`default_*`関数と`virtual_env_defaults`定数）
   - deprecatedフィールド（docコメントで明示）

2. README.mdの`Configuration Options`テーブルと比較:
   - フィールドの欠落（特に`virtual_env_handling`セクション）
   - デフォルト値の不一致
   - 設定例の構造が現在のスキーマと矛盾しないか

**既知の注意点:**
- `CopyIgnoredFilesConfig`のデフォルトは`default_copy_enabled()`=`true`, `default_copy_patterns()`=`[".env", ".env.*", ".env.local", ".env.*.local"]`
- `default_exclude_patterns()`=`[".env.example", ".env.sample"]`
- `VirtualEnvConfig`のデフォルトは`virtual_env_defaults`モジュール定数を参照

### Check 4: README ↔ README_JA 構造整合

英語版と日本語版で同じコマンド・オプション・設定が記載されているか確認する。

`README.md`と`README_JA.md`の以下を構造的に比較（翻訳内容の正確性は対象外）:
- Commandsテーブルの行数とコマンド名
- 各コマンドのオプションテーブルの行数とオプション名
- Configuration Optionsテーブルの行数と項目名
- セクション構成（h2, h3レベル）

### Check 5: 環境変数の網羅性

コード内の`GWM_`プレフィックス環境変数がREADMEに記載されているか確認する。

1. ソースコード内を検索: `grep -rn 'GWM_' src/ --include='*.rs'`（テストコード除外）
2. README.mdの環境変数セクションと照合
3. カテゴリ分類して報告:
   - **Hook環境変数** (`GWM_WORKTREE_PATH`, `GWM_BRANCH_NAME`, `GWM_REPO_ROOT`, `GWM_REPO_NAME`): 必須記載
   - **内部環境変数** (`GWM_CWD_FILE`, `GWM_HOOKS_FILE`): shell integrationセクションでの言及が望ましい
   - **デバッグ変数** (`GWM_DEBUG`): 記載任意

### Check 6: deprecated構文チェック

READMEの使用例がdeprecated構文を使っていないか確認する。

args.rsで`hide = true`かつdeprecatedコメントがあるオプション:
- `--code` → 代替: `--open code` または `-o code`
- `--cursor` → 代替: `--open cursor` または `-o cursor`
- `-c` (goコマンド) → 代替: `-o code`

README.md/README_JA.mdの全文を検索し、これらが使用例に含まれていないか確認する。

## 意図的な除外（false positive防止）

以下はhide=trueまたは内部用途のため、ドキュメントに**記載しないことが正しい**:
- `Init`コマンド（shell integration経由でのみ使用）
- `Completion`コマンド（shell completion生成用）
- `--code`, `--cursor`フラグ（deprecated、hide=true）
- `--run-deferred-hooks`（内部使用）
- `GWM_DEBUG`（開発用）

これらがドキュメントに存在しないことは不整合ではない。

## 報告フォーマット

```
## docs-sync チェック結果

### サマリー
| チェック | 結果 | 不整合数 |
|---------|------|---------|
| Check 1: CLI Args → Help Text | OK/NG | N件 |
| Check 2: CLI Args → README | OK/NG | N件 |
| Check 3: Config Types → README | OK/NG | N件 |
| Check 4: README ↔ README_JA | OK/NG | N件 |
| Check 5: 環境変数 | OK/NG | N件 |
| Check 6: deprecated構文 | OK/NG | N件 |

### 不整合の詳細
#### [Check N] カテゴリ名
**不整合 N-1: [説明]**
- ソース: `[ファイル:行番号]` の内容
- ドキュメント: `[ファイル:行番号]` の内容
- 種類: 欠落 / 不一致 / deprecated使用
- 影響度: HIGH / MEDIUM / LOW
- 修正案: [具体的な修正内容]
```

影響度の基準:
- **HIGH**: ユーザーが誤った情報を得る（デフォルト値の不一致等）
- **MEDIUM**: 情報不足（セクション欠落等）
- **LOW**: 軽微な差異（フォーマットの違い等）

## 修正の適用順序

1. SOURCE OF TRUTHが正しいか確認（args.rs/types.rsが誤っている可能性もある）
2. `src/ui/views/help.rs`を修正
3. `README.md`を修正
4. `README_JA.md`を修正（README.mdの構造変更に合わせる）
5. `cargo test`で既存テスト通過を確認
6. `cargo run -- help` および各サブコマンドのhelp出力を確認

## ヘルパースクリプト

`scripts/extract-metadata.sh` で機械的なメタデータ抽出が可能:

```bash
bash .claude/skills/docs-sync/scripts/extract-metadata.sh
```

出力: 非hiddenコマンド/オプション一覧、設定フィールド一覧、環境変数一覧。
スクリプトがなくても上記手順でファイルを直接読んでチェック可能。
