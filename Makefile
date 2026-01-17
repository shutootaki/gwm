# gwm-rust Makefile
# CI と同等のチェックをローカルで実行するためのタスク定義

# MSRV (Minimum Supported Rust Version) - Cargo.toml と同期させること
MSRV := 1.74

.PHONY: all check fmt clippy test build msrv-check ci clean help

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

# MSRV チェック (rustup が必要)
# CI と同じ Rust バージョンでビルドできることを確認
msrv-check:
	@echo "Checking MSRV ($(MSRV))..."
	@if command -v rustup >/dev/null 2>&1; then \
		rustup run $(MSRV) cargo check --all-features; \
	else \
		echo "Warning: rustup not found. Skipping MSRV check."; \
		echo "Install rustup to enable MSRV verification."; \
	fi

# CI と同等の全チェックを実行
ci: fmt clippy test msrv-check
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
	@echo "  msrv-check  - Verify build with MSRV ($(MSRV))"
	@echo "  ci          - Run all CI checks locally"
	@echo "  clean       - Clean build artifacts"
	@echo "  help        - Show this help"
