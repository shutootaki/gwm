# Gitignoreされたファイルのコピー機能 - 仕様書

## 概要

`gwm add`コマンドで新しいワークツリーを作成する際に、gitignoreされたファイル（.envファイルなど）をメインワークツリーから新規ワークツリーにコピーする機能を実装する。

## 背景

Git worktreeは、gitで管理されているファイルのみを新しいワークツリーに含めるため、.gitignoreされたファイル（環境変数ファイルなど）は含まれない。これらのファイルは開発環境の設定に必要な場合が多く、手動でコピーする手間を省きたい。

## 実装方針

### 1. 設定ファイルの拡張

`~/.config/gwm/config.toml`に新しい設定を追加：

```toml
# gitignoreされたファイルのコピー設定
[copy_ignored_files]
enabled = true  # 機能の有効/無効
patterns = [".env", ".env.*", ".env.local", ".env.*.local"]  # コピー対象のファイルパターン
exclude_patterns = [".env.example", ".env.sample"]  # 除外パターン
```

### 2. Config型の拡張

`src/config.ts`の`Config`インターフェースに新しいフィールドを追加：

```typescript
export interface Config {
  worktree_base_path: string;
  main_branches: string[];
  clean_branch: 'auto' | 'ask' | 'never';
  copy_ignored_files?: {
    enabled: boolean;
    patterns: string[];
    exclude_patterns?: string[];
  };
}
```

### 3. ユーティリティ関数の追加

`src/utils/git.ts`に以下の関数を追加：

```typescript
/**
 * メインワークツリーのパスを取得
 */
export function getMainWorktreePath(): string;

/**
 * gitignoreされたファイルのリストを取得
 */
export function getIgnoredFiles(workdir: string, patterns: string[]): string[];

/**
 * ファイルを別のディレクトリにコピー
 */
export function copyFiles(
  sourceDir: string,
  targetDir: string,
  files: string[]
): void;
```

### 4. useWorktreeフックの拡張

`src/hooks/useWorktree.ts`の`createWorktree`関数内で、ワークツリー作成後にgitignoreされたファイルをコピーする処理を追加：

1. ワークツリー作成（既存の処理）
2. 設定で`copy_ignored_files.enabled`がtrueの場合：
   - メインワークツリーのパスを取得
   - 指定されたパターンに一致するgitignoreされたファイルを検出
   - 検出されたファイルを新しいワークツリーにコピー
   - コピーしたファイルのリストをアクションに追加

### 5. UI/UXの改善

- ファイルがコピーされた場合、成功メッセージにコピーしたファイルのリストを表示
- コピーに失敗した場合、エラーメッセージを表示（ただし、ワークツリー作成自体は成功扱い）

## 実装の詳細

### gitignoreされたファイルの検出

1. `git ls-files --others --ignored --exclude-standard`コマンドを使用
2. 結果を設定のパターンでフィルタリング
3. 除外パターンにマッチするファイルを除外

### ファイルコピーの実装

1. Node.jsの`fs.copyFileSync`を使用
2. ディレクトリ構造を保持してコピー
3. シンボリックリンクは実ファイルとしてコピー
4. ファイルのパーミッションを保持

### エラーハンドリング

- メインワークツリーが見つからない場合：警告を表示してスキップ
- ファイルコピーに失敗した場合：個別のエラーメッセージを表示
- 設定が不正な場合：デフォルト設定にフォールバック

## テスト計画

1. 単体テスト
   - `getIgnoredFiles`関数のテスト
   - `copyFiles`関数のテスト
   - 設定の読み込みテスト

2. 統合テスト
   - `gwm add`実行時のファイルコピー動作確認
   - 各種エラーケースの確認

## セキュリティ考慮事項

- コピー対象をgitignoreされたファイルに限定
- ファイルパスのサニタイズ
- シンボリックリンクの適切な処理

## 今後の拡張可能性

- インタラクティブモード：コピーするファイルを選択可能に
- テンプレート機能：.env.exampleから.envを生成
- 暗号化されたファイルの復号化サポート
