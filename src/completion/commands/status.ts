/**
 * gwm completion status コマンド
 * 補完のインストール状況を表示
 */

import { existsSync } from 'fs';
import type { ShellType } from '../types.js';
import { getDefaultInstallPath, getKiroInstallPath } from './paths.js';

export interface StatusInfo {
  shell: ShellType | 'kiro';
  installed: boolean;
  path: string;
}

/**
 * インストール先パスを取得
 */
function getInstallPaths(): StatusInfo[] {
  return [
    {
      shell: 'bash' as const,
      path: getDefaultInstallPath('bash'),
      installed: false,
    },
    {
      shell: 'zsh' as const,
      path: getDefaultInstallPath('zsh'),
      installed: false,
    },
    {
      shell: 'fish' as const,
      path: getDefaultInstallPath('fish'),
      installed: false,
    },
    {
      shell: 'kiro' as const,
      path: getKiroInstallPath(),
      installed: false,
    },
  ];
}

/**
 * ステータスを取得
 */
export function getStatus(): StatusInfo[] {
  const paths = getInstallPaths();

  for (const info of paths) {
    info.installed = existsSync(info.path);
  }

  return paths;
}

/**
 * ステータスをフォーマット
 */
export function formatStatus(statuses: StatusInfo[]): string {
  const lines: string[] = ['Completion Status:', ''];

  for (const status of statuses) {
    const label =
      status.shell === 'kiro' ? 'Kiro/Fig' : status.shell.toUpperCase();
    const icon = status.installed ? '✓' : '✗';
    const state = status.installed ? 'installed' : 'not installed';
    lines.push(`  ${icon} ${label.padEnd(10)} ${state}`);
    if (status.installed) {
      lines.push(`    └─ ${status.path}`);
    }
  }

  return lines.join('\n');
}
