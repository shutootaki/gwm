/**
 * アプリケーション共通定数
 */

// ブランチ名関連
export const BRANCH_NAME = {
  MAX_LENGTH: 255,
  // eslint-disable-next-line no-control-regex
  FORBIDDEN_CHARS: /[\x00-\x1f\x7f~^:?*[\\\s]/,
  FORBIDDEN_PATTERNS: /\.\./,
} as const;

// ファイルサイズ制限（バイト）
export const FILE_SIZE = {
  DEFAULT_MAX_FILE_MB: 100,
  DEFAULT_MAX_DIR_MB: 500,
  MB_TO_BYTES: 1024 * 1024,
} as const;

// 並列処理関連
export const CONCURRENCY = {
  DEFAULT_PARALLELISM: 4,
  MAX_PARALLELISM: 16,
} as const;

// ディレクトリ走査関連
export const DIRECTORY = {
  DEFAULT_MAX_SCAN_DEPTH: 5,
  UNLIMITED_DEPTH: -1,
} as const;

// タイムアウト関連（ミリ秒）
export const TIMEOUT = {
  DEFAULT_COMMAND: 30000, // 30秒
  LONG_OPERATION: 300000, // 5分
  SHORT_OPERATION: 5000, // 5秒
} as const;

// リトライ関連
export const RETRY = {
  DEFAULT_MAX_RETRIES: 3,
  DEFAULT_DELAY_MS: 1000,
  EXPONENTIAL_BASE: 2,
} as const;

// Git関連
export const GIT = {
  DEFAULT_MAIN_BRANCHES: ['main', 'master', 'develop'],
  WORKTREE_STATUS: {
    MAIN: 'MAIN',
    ACTIVE: 'ACTIVE',
    OTHER: 'OTHER',
  },
} as const;

// ファイルパターン
export const FILE_PATTERNS = {
  ENV_FILES: ['.env', '.env.*', '.env.local', '.env.*.local'],
  ENV_EXAMPLES: ['.env.example', '.env.sample'],
  GIT_IGNORE: '.git',
} as const;

// 仮想環境関連
export const VIRTUAL_ENV = {
  COMMON_PATTERNS: [
    'node_modules',
    'venv',
    '.venv',
    'env',
    '.env',
    '__pycache__',
    '.tox',
    'vendor',
  ],
} as const;

// エラーメッセージのキーワード
export const ERROR_KEYWORDS = {
  NOT_GIT_REPO: 'not a git repository',
  NO_REMOTE: 'no such remote',
  NETWORK: 'network',
  FETCH: 'fetch',
  WORKTREE_EXISTS: 'already exists',
  PERMISSION_DENIED: 'permission denied',
} as const;

// 設定ファイル関連
export const CONFIG = {
  FILE_NAMES: ['config.toml', '.gwmrc'],
  CLEAN_BRANCH_OPTIONS: ['auto', 'ask', 'never'],
  VIRTUAL_ENV_MODES: ['skip', 'ignore'],
} as const;

// UI関連
export const UI = {
  MIN_TERMINAL_WIDTH: 80,
  DEFAULT_TERMINAL_WIDTH: 120,
  STATUS_COLUMN_WIDTH: 14,
  HEAD_COLUMN_WIDTH: 10,
  SPACING_WIDTH: 6,
  MIN_BRANCH_WIDTH: 15,
  MIN_PATH_WIDTH: 20,
} as const;
