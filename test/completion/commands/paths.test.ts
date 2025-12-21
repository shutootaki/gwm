/**
 * paths.ts のテスト
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { join } from 'path';
import {
  getDefaultInstallPath,
  getKiroInstallPath,
  getRcFilePath,
  RC_MARKER_START,
  RC_MARKER_END,
} from '../../../src/completion/commands/paths.js';

// homedir をモック
vi.mock('os', () => ({
  homedir: vi.fn().mockReturnValue('/mock/home'),
}));

describe('paths', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getDefaultInstallPath', () => {
    it('bash 用のパスを返す', () => {
      const path = getDefaultInstallPath('bash');
      expect(path).toBe(
        join(
          '/mock/home',
          '.local',
          'share',
          'bash-completion',
          'completions',
          'gwm'
        )
      );
    });

    it('zsh 用のパスを返す', () => {
      const path = getDefaultInstallPath('zsh');
      expect(path).toBe(join('/mock/home', '.zsh', 'completions', '_gwm'));
    });

    it('fish 用のパスを返す', () => {
      const path = getDefaultInstallPath('fish');
      expect(path).toBe(
        join('/mock/home', '.config', 'fish', 'completions', 'gwm.fish')
      );
    });
  });

  describe('getKiroInstallPath', () => {
    it('Kiro/Fig spec のパスを返す', () => {
      const path = getKiroInstallPath();
      expect(path).toBe(
        join('/mock/home', '.fig', 'autocomplete', 'build', 'gwm.js')
      );
    });
  });

  describe('getRcFilePath', () => {
    it('zsh の場合 .zshrc を返す', () => {
      const path = getRcFilePath('zsh');
      expect(path).toBe(join('/mock/home', '.zshrc'));
    });

    it('bash の場合 .bashrc を返す', () => {
      const path = getRcFilePath('bash');
      expect(path).toBe(join('/mock/home', '.bashrc'));
    });

    it('fish の場合 null を返す', () => {
      const path = getRcFilePath('fish');
      expect(path).toBeNull();
    });
  });

  describe('RC マーカー定数', () => {
    it('RC_MARKER_START が定義されている', () => {
      expect(RC_MARKER_START).toBe('# >>> gwm completion >>>');
    });

    it('RC_MARKER_END が定義されている', () => {
      expect(RC_MARKER_END).toBe('# <<< gwm completion <<<');
    });
  });
});
