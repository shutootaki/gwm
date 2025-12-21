/**
 * シェル補完スクリプト生成のエントリーポイント
 */

import type { ShellType, CompletionDefinition } from '../../types.js';
import { completionDefinition } from '../../definition.js';
import { generateBashScript } from './bash.js';
import { generateZshScript } from './zsh.js';
import { generateFishScript } from './fish.js';

export { generateBashScript } from './bash.js';
export { generateZshScript } from './zsh.js';
export { generateFishScript } from './fish.js';

/**
 * 指定されたシェル向けの補完スクリプトを生成
 */
export function generateShellScript(
  shell: ShellType,
  definition: CompletionDefinition = completionDefinition
): string {
  switch (shell) {
    case 'bash':
      return generateBashScript(definition);
    case 'zsh':
      return generateZshScript(definition);
    case 'fish':
      return generateFishScript(definition);
    default:
      throw new Error(`Unsupported shell: ${shell}`);
  }
}
