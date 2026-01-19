# gwm-rust Makefile
# CI と同等のチェックをローカルで実行するためのタスク定義

.PHONY: all check fmt clippy test build ci clean help

# デフォルトターゲット
all: check

# 基本的なコンパイルチェック
check:
	cargo check --all-features

# フォーマットチェック
fmt:
	cargo fmt --all -- --check

# フォーマット適用
fmt-fix:
	cargo fmt --all

# Clippy lint チェック
clippy:
	cargo clippy --all-targets --all-features -- -D warnings

# テスト実行
test:
	cargo test --verbose

# リリースビルド
build:
	cargo build --release

# CI と同等の全チェックを実行
ci: fmt clippy test
	@echo "All CI checks passed!"

# ビルド成果物のクリーンアップ
clean:
	cargo clean

# ヘルプ
help:
	@echo "Available targets:"
	@echo "  all         - Run 'check' (default)"
	@echo "  check       - Run cargo check"
	@echo "  fmt         - Check code formatting"
	@echo "  fmt-fix     - Apply code formatting"
	@echo "  clippy      - Run Clippy lints"
	@echo "  test        - Run tests"
	@echo "  build       - Build release binary"
	@echo "  ci          - Run all CI checks locally"
	@echo "  clean       - Clean build artifacts"
	@echo "  help        - Show this help"
