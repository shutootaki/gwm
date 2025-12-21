/**
 * 補完スクリプトのパス関連ユーティリティ
 * install / uninstall / status で共通利用
 */

import { join } from 'path';
import { homedir } from 'os';
import type { ShellType } from '../types.js';

/**
 * RC ファイルのマーカー
 */
export const RC_MARKER_START = '# >>> gwm completion >>>';
export const RC_MARKER_END = '# <<< gwm completion <<<';

/**
 * シェル補完スクリプトのデフォルトインストール先を取得
 */
export function getDefaultInstallPath(shell: ShellType): string {
  const home = homedir();
  switch (shell) {
    case 'bash':
      return join(
        home,
        '.local',
        'share',
        'bash-completion',
        'completions',
        'gwm'
      );
    case 'zsh':
      return join(home, '.zsh', 'completions', '_gwm');
    case 'fish':
      return join(home, '.config', 'fish', 'completions', 'gwm.fish');
  }
}

/**
 * Kiro/Fig spec のインストール先を取得
 */
export function getKiroInstallPath(): string {
  return join(homedir(), '.fig', 'autocomplete', 'build', 'gwm.js');
}

/**
 * RC ファイルのパスを取得
 * @returns RCファイルのパス。fishの場合は自動読み込みのためnull
 */
export function getRcFilePath(shell: ShellType): string | null {
  const home = homedir();
  switch (shell) {
    case 'zsh':
      return join(home, '.zshrc');
    case 'bash':
      return join(home, '.bashrc');
    case 'fish':
      return null; // fish は自動で読み込む
  }
}
