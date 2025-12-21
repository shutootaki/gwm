/**
 * 補完定義用の型定義
 * Single Source of Truth のための型システム
 */

/**
 * 候補プロバイダID
 * 動的に候補を生成するプロバイダを識別する
 */
export type CompletionProviderId =
  | 'worktrees' // worktree一覧
  | 'localBranches' // ローカルブランチ一覧
  | 'remoteBranchesOrigin' // リモートブランチ一覧（origin）
  | 'subcommands' // サブコマンド一覧
  | 'cleanBranchModes'; // --clean-branch の値候補

/**
 * 引数定義
 */
export interface CompletionArg {
  /** 表示名（例: "branch_name"） */
  name: string;
  /** 説明文 */
  description?: string;
  /** 必須かどうか */
  required: boolean;
  /** 複数値を受け取るか */
  isVariadic?: boolean;
  /** 動的候補プロバイダID */
  providers?: CompletionProviderId[];
  /** 静的候補値（例: ["auto", "ask", "never"]） */
  staticValues?: string[];
}

/**
 * オプション定義
 */
export interface CompletionOption {
  /** オプション名の配列（例: ["-r", "--remote"]） */
  names: string[];
  /** 説明文 */
  description?: string;
  /** 値を取るかどうか */
  takesValue: boolean;
  /** 値の引数定義（takesValue=true の場合） */
  valueArg?: CompletionArg;
  /** サブコマンドにも継承されるか */
  isPersistent?: boolean;
}

/**
 * コマンド定義
 */
export interface CompletionCommand {
  /** コマンド名 */
  name: string;
  /** 別名（例: ["ls"] for "list"） */
  aliases?: string[];
  /** 説明文 */
  description?: string;
  /** オプション定義 */
  options?: CompletionOption[];
  /** 位置引数定義 */
  args?: CompletionArg[];
  /** サブコマンド定義 */
  subcommands?: CompletionCommand[];
  /** helpに表示しない隠しコマンド */
  hidden?: boolean;
}

/**
 * ルート定義（Single Source of Truth）
 */
export interface CompletionDefinition {
  /** ルートコマンド名 */
  rootName: 'gwm';
  /** 説明文 */
  description: string;
  /** サブコマンド定義 */
  commands: CompletionCommand[];
  /** グローバルオプション */
  globalOptions?: CompletionOption[];
}

/**
 * シェルの種類
 */
export type ShellType = 'bash' | 'zsh' | 'fish';

/**
 * 補完コンテキストの位置
 */
export type CursorPosition =
  | 'subcommand' // サブコマンドを補完
  | 'option' // オプションを補完
  | 'optionValue' // オプションの値を補完
  | 'positional'; // 位置引数を補完

/**
 * コマンド実行結果（install, uninstall 等で共通使用）
 */
export interface CommandResult {
  /** 成功したかどうか */
  success: boolean;
  /** 結果メッセージ */
  message: string;
  /** 操作対象のパス */
  path?: string;
  /** RC ファイルを修正したかどうか */
  rcModified?: boolean;
}
