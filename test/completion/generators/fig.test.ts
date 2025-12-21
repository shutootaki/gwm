/**
 * Fig completion spec 生成のテスト
 */

import { describe, it, expect } from 'vitest';
import { generateFigSpec } from '../../../src/completion/generators/fig/spec.js';
import { completionDefinition } from '../../../src/completion/definition.js';

describe('generateFigSpec', () => {
  it('Fig specを生成する', () => {
    const spec = generateFigSpec(completionDefinition);
    expect(spec).toContain('completionSpec');
    expect(spec).toContain('"name": "gwm"');
  });

  it('サブコマンドが含まれる', () => {
    const spec = generateFigSpec(completionDefinition);
    expect(spec).toContain('"list"');
    expect(spec).toContain('"add"');
    expect(spec).toContain('"go"');
    expect(spec).toContain('"remove"');
    expect(spec).toContain('"completion"');
  });

  it('エイリアスが含まれる', () => {
    const spec = generateFigSpec(completionDefinition);
    // list のエイリアス ls が配列形式で含まれる
    expect(spec).toContain('"ls"');
    expect(spec).toContain('"rm"');
  });

  it('オプションが含まれる', () => {
    const spec = generateFigSpec(completionDefinition);
    expect(spec).toContain('--remote');
    expect(spec).toContain('--from');
    expect(spec).toContain('--force');
  });

  it('generator が含まれる', () => {
    const spec = generateFigSpec(completionDefinition);
    expect(spec).toContain('gwm completion __fig_worktrees');
    expect(spec).toContain('gwm completion __fig_branches_local');
  });

  it('CommonJS と ES Module のエクスポートが含まれる', () => {
    const spec = generateFigSpec(completionDefinition);
    expect(spec).toContain('module.exports');
    expect(spec).toContain('exports.default');
  });

  it('スナップショットが安定している', () => {
    const spec = generateFigSpec(completionDefinition);
    expect(spec).toMatchSnapshot();
  });
});
