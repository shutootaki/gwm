/**
 * gwm completion install コマンド
 * 補完スクリプトをインストール
 */

import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'fs';
import { dirname } from 'path';
import type { ShellType, CommandResult } from '../types.js';
import { generateShellScript } from '../generators/shell/index.js';
import { generateFigSpec } from '../generators/fig/spec.js';
import {
  getDefaultInstallPath,
  getKiroInstallPath,
  getRcFilePath,
  RC_MARKER_START,
  RC_MARKER_END,
} from './paths.js';

export interface InstallArgs {
  shell?: ShellType;
  kiro?: boolean;
  dryRun?: boolean;
  modifyRc?: boolean;
  path?: string;
}

/**
 * 引数をパース
 */
export function parseInstallArgs(args: string[]): InstallArgs {
  const result: InstallArgs = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--shell' && i + 1 < args.length) {
      const nextArg = args[++i];
      if (nextArg === 'bash' || nextArg === 'zsh' || nextArg === 'fish') {
        result.shell = nextArg;
      }
    } else if (arg === '--kiro') {
      result.kiro = true;
    } else if (arg === '--dry-run') {
      result.dryRun = true;
    } else if (arg === '--modify-rc') {
      result.modifyRc = true;
    } else if (arg === '--path' && i + 1 < args.length) {
      result.path = args[++i];
    }
  }

  return result;
}

/**
 * RC ファイルに追記する内容を取得
 */
function getRcContent(shell: ShellType): string {
  switch (shell) {
    case 'zsh':
      return `${RC_MARKER_START}
# Add gwm completion to fpath and reinitialize completion
fpath=(~/.zsh/completions $fpath)
autoload -Uz compinit && compinit
${RC_MARKER_END}`;
    case 'bash':
      return `${RC_MARKER_START}
# Load gwm completion
if [[ -f ~/.local/share/bash-completion/completions/gwm ]]; then
  source ~/.local/share/bash-completion/completions/gwm
fi
${RC_MARKER_END}`;
    case 'fish':
      // fish は自動で読み込むため不要
      return '';
  }
}

/**
 * RC ファイルにすでにマーカーがあるか確認
 */
function hasRcMarker(rcPath: string): boolean {
  if (!existsSync(rcPath)) {
    return false;
  }
  const content = readFileSync(rcPath, 'utf8');
  return content.includes(RC_MARKER_START);
}

/** InstallResult は CommandResult の別名（後方互換性のため） */
export type InstallResult = CommandResult;

/**
 * install コマンドを実行
 */
export function runInstall(args: InstallArgs): CommandResult {
  // Kiro/Fig インストール
  if (args.kiro) {
    const installPath = getKiroInstallPath();
    const content = generateFigSpec();

    if (args.dryRun) {
      let message = `[Dry run] Would install Kiro/Fig spec to:\n  ${installPath}`;
      message += '\n\nAfter install: Ready to use immediately.';
      return {
        success: true,
        message,
        path: installPath,
      };
    }

    try {
      mkdirSync(dirname(installPath), { recursive: true });
      writeFileSync(installPath, content, 'utf8');

      let message = `Installed Kiro/Fig spec to:\n  ${installPath}`;
      message +=
        '\n\n✓ Ready to use! Kiro CLI will load the spec automatically.';
      message += '\n  Try typing: gwm';

      return {
        success: true,
        message,
        path: installPath,
      };
    } catch (err) {
      return {
        success: false,
        message: `Failed to install: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }

  // シェル補完インストール
  if (!args.shell) {
    return {
      success: false,
      message: 'Error: --shell or --kiro option is required',
    };
  }

  // カスタムパスの親ディレクトリ検証
  if (args.path) {
    const parentDir = dirname(args.path);
    if (!existsSync(parentDir)) {
      return {
        success: false,
        message: `Error: Parent directory does not exist: ${parentDir}`,
      };
    }
  }

  const installPath = args.path || getDefaultInstallPath(args.shell);
  const script = generateShellScript(args.shell);

  if (args.dryRun) {
    let message = `[Dry run] Would install ${args.shell} completion to:\n  ${installPath}`;

    if (args.shell === 'fish') {
      message += '\n\nAfter install: Ready to use immediately.';
    } else if (args.modifyRc) {
      const rcPath = getRcFilePath(args.shell);
      if (rcPath) {
        message += `\n\nWould also modify:\n  ${rcPath}`;
        message +=
          '\n\nAfter install: Restart your shell to enable completion.';
      }
    } else {
      message += `\n\nAfter install: Manual setup required in ~/.${args.shell}rc`;
      message += '\n  (Use --modify-rc to automate this)';
    }

    return {
      success: true,
      message,
      path: installPath,
    };
  }

  try {
    // ディレクトリ作成
    mkdirSync(dirname(installPath), { recursive: true });
    // スクリプト書き込み
    writeFileSync(installPath, script, 'utf8');

    let rcModified = false;

    // RC ファイル修正
    if (args.modifyRc) {
      const rcPath = getRcFilePath(args.shell);
      if (rcPath && !hasRcMarker(rcPath)) {
        const rcContent = getRcContent(args.shell);
        if (rcContent) {
          const currentContent = existsSync(rcPath)
            ? readFileSync(rcPath, 'utf8')
            : '';
          writeFileSync(
            rcPath,
            currentContent + '\n' + rcContent + '\n',
            'utf8'
          );
          rcModified = true;
        }
      }
    }

    let message = `Installed ${args.shell} completion to:\n  ${installPath}`;

    if (args.shell === 'fish') {
      // fish は自動読み込みのため追加設定不要
      message += '\n\n✓ Ready to use! Fish loads completions automatically.';
      message += '\n  Try: gwm <TAB>';
    } else if (rcModified) {
      // RC ファイルを修正した場合
      message += '\n\nNext steps:';
      if (args.shell === 'zsh') {
        message += '\n  1. Clear completion cache: rm ~/.zcompdump*';
        message += '\n  2. Restart your shell, or run: source ~/.zshrc';
      } else {
        message += '\n  Restart your shell, or run:';
        message += `\n  source ~/.${args.shell}rc`;
      }
      message += '\n\nThen try: gwm <TAB>';
    } else {
      // RC ファイルを修正していない場合（手動設定が必要）
      message += '\n\nNext steps:';
      message += `\n  1. Add to ~/.${args.shell}rc:`;
      if (args.shell === 'zsh') {
        message += '\n     fpath=(~/.zsh/completions $fpath)';
        message += '\n     autoload -Uz compinit && compinit';
        message += '\n  2. Clear completion cache: rm ~/.zcompdump*';
        message += '\n  3. Restart your shell or run: source ~/.zshrc';
        message += '\n  4. Try: gwm <TAB>';
      } else if (args.shell === 'bash') {
        message += `\n     source ${installPath}`;
        message += '\n  2. Restart your shell or run:';
        message += `\n     source ~/.${args.shell}rc`;
        message += '\n  3. Try: gwm <TAB>';
      }
      message += '\n\nTip: Use --modify-rc to automate step 1';
    }

    return {
      success: true,
      message,
      path: installPath,
      rcModified,
    };
  } catch (err) {
    return {
      success: false,
      message: `Failed to install: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}
