# Python プロジェクトでの .venv 問題解決 - 実装完了

## 問題の概要

パイソンで書かれたアプリケーションを管理しているリポジトリで `gwm add` を実行した場合、`.venv` のパスが大元のワークツリーを参照してしまうため、新しく作成したワークツリー内に `.venv` を正常に作成することができない問題がありました。

## 解決策の実装

### 1. Pythonプロジェクト自動検出機能

新しく `isPythonProject()` 関数を実装し、以下のファイルの存在を確認してPythonプロジェクトを自動検出します：

- `pyproject.toml`
- `poetry.lock`
- `requirements.txt`
- `requirements-dev.txt`
- `setup.py`
- `setup.cfg`
- `Pipfile`
- `Pipfile.lock`
- `conda.yml`
- `environment.yml`

### 2. 設定ファイルの拡張

`~/.config/gwm/config.toml` に新しい Python 関連設定を追加しました：

```toml
[python]
auto_detect = true  # Pythonプロジェクトの自動検出を有効にする（デフォルト: true）
exclude_venv = true  # .venvディレクトリを自動除外する（デフォルト: true）
suggest_venv_recreate = true  # venv再作成の提案を表示する（デフォルト: true）
exclude_patterns = [".venv", ".venv/*", "__pycache__", "*.pyc", "*.pyo", ".pytest_cache"]  # Python固有の除外パターン
```

### 3. .venv 自動除外機能

Pythonプロジェクトが検出された場合、以下の処理が自動実行されます：

1. **`.venv` ディレクトリの自動除外**: gitignoreされたファイルのコピー処理で `.venv` ディレクトリを自動的に除外
2. **Python固有ファイルの除外**: `__pycache__`、`*.pyc`、`.pytest_cache` などのPython固有の一時ファイルも除外

### 4. venv 再作成ガイダンス

新しいワークツリー作成時に、Pythonプロジェクトが検出された場合は適切なvenv再作成コマンドを提案：

- **Poetry プロジェクト**: `poetry install`
- **Pipenv プロジェクト**: `pipenv install`
- **requirements.txt**: `python -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt`
- **その他**: `python -m venv .venv`

### 5. 設定のカスタマイズ

ユーザーは設定ファイルで以下をカスタマイズ可能：

- Python自動検出のオン/オフ
- .venv除外のオン/オフ
- venv再作成提案のオン/オフ
- カスタム除外パターンの追加

## 使用方法

### 基本的な使用方法

1. **設定ファイルの作成**（オプション）:
   ```bash
   mkdir -p ~/.config/gwm
   cat > ~/.config/gwm/config.toml << 'EOF'
   [python]
   auto_detect = true
   exclude_venv = true
   suggest_venv_recreate = true
   EOF
   ```

2. **ワークツリーの作成**:
   ```bash
   # Pythonプロジェクトで実行
   gwm add feature/new-feature
   ```

3. **venv再作成**（新しいワークツリーで）:
   ```bash
   cd path/to/new/worktree
   poetry install  # または表示された適切なコマンド
   ```

### 期待される結果

- ✅ `.venv` ディレクトリがコピーされなくなる
- ✅ 新しいワークツリーで独立したvenvを作成可能
- ✅ 適切なvenv再作成コマンドが提案される
- ✅ Python固有の一時ファイルも除外される

## 従来の手動作業との比較

### 従来の解決方法
1. 大元のブランチにあるvenvを削除する
2. 新規ワークツリーでvenvの参照先設定を変更する
3. 新規ワークツリーでvenvを作成するコマンドを実行する

### 新しい自動化された方法
1. `gwm add` を実行するだけ
2. 表示される提案に従ってvenvを再作成

## 技術的詳細

### 実装されたファイル

- `src/utils/git.ts`: `isPythonProject()` 関数、`getIgnoredFiles()` 更新
- `src/config.ts`: Python設定の追加
- `src/hooks/useWorktree.ts`: venv再作成提案の追加
- `test/python-detection.test.ts`: テストケースの追加

### 互換性

- 既存の設定ファイルとの完全な後方互換性
- デフォルト設定でPython対応が有効
- 非Pythonプロジェクトでは従来通りの動作

## まとめ

この実装により、Pythonプロジェクトでの `gwm add` 実行時に `.venv` の問題が自動的に解決され、開発者の手動作業が大幅に削減されます。設定も柔軟にカスタマイズ可能で、様々なPythonプロジェクト構成に対応しています。