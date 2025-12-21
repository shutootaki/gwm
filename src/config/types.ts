/**
 * 個別 hook の設定
 */
export interface HookConfig {
  /** hook を有効にするかどうか（省略時は true） */
  enabled?: boolean;
  /** 実行するコマンドの配列 */
  commands?: string[];
}

/**
 * hooks セクションの設定
 */
export interface HooksConfig {
  /** worktree 作成後に実行する hook */
  post_create?: HookConfig;
}

export interface Config {
  worktree_base_path: string;
  main_branches: string[];
  /**
   * worktree 削除後に同名ローカルブランチを掃除するかどうか
   * "auto" | "ask" | "never" (既定: "ask")
   */
  clean_branch: 'auto' | 'ask' | 'never';
  /**
   * gitignoreされたファイルのコピー設定
   */
  copy_ignored_files?: {
    enabled: boolean;
    patterns: string[];
    exclude_patterns?: string[];
  };

  /**
   * 仮想環境処理の設定
   * mode: "skip" (検出したらコピーしない, デフォルト) | "ignore" (スキップしない)
   * custom_patterns: 任意の追加パターン
   */
  virtual_env_handling?: {
    /**
     * 仮想環境隔離機能を有効にするかどうか。
     * true  : 仮想環境ディレクトリをコピーせず、シンボリックリンクを書き換える
     * false : 従来通りコピーし、リンクもそのまま
     * ※ 旧フィールド mode ("skip"|"ignore") からの後方互換あり。
     */
    isolate_virtual_envs?: boolean;
    /** @deprecated v0.10 で削除予定。isolate_virtual_envs に置き換え */
    mode?: 'skip' | 'ignore';
    custom_patterns?: {
      language: string;
      patterns: string[];
      commands?: string[];
    }[];
    /**
     * 1ファイルあたりコピーを許可する最大サイズ (MB)。-1 または未設定で無制限。
     * ※ v0.9 以前との互換性のため、旧キー "max_copy_size_mb" も受け付ける。
     */
    max_file_size_mb?: number;
    /** 1ディレクトリ(合計)でコピーを許可する最大サイズ (MB)。-1 または未設定で無制限。*/
    max_dir_size_mb?: number;
    /** ディレクトリ走査の最大深さ。-1 で無制限 */
    max_scan_depth?: number;
    /** コピー処理の並列度。0 で論理 CPU コア数を利用 */
    copy_parallelism?: number;
    /**
     * @deprecated max_file_size_mb に置き換え予定
     */
    max_copy_size_mb?: number;
  };

  /**
   * hooks 設定
   */
  hooks?: HooksConfig;
}

export type RawParsedConfig = Partial<Record<string, unknown>>;
