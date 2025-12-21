/**
 * シェル補完スクリプト生成のテスト
 */

import { describe, it, expect } from 'vitest';
import {
  generateBashScript,
  generateZshScript,
  generateFishScript,
  generateShellScript,
} from '../../../src/completion/generators/shell/index.js';
import { completionDefinition } from '../../../src/completion/definition.js';

describe('generateBashScript', () => {
  it('bash補完スクリプトを生成する', () => {
    const script = generateBashScript(completionDefinition);
    expect(script).toContain('#!/bin/bash');
    expect(script).toContain('_gwm_complete');
    expect(script).toContain('complete -F _gwm_complete gwm');
    expect(script).toContain('gwm completion __complete');
  });

  it('スナップショットが安定している', () => {
    const script = generateBashScript(completionDefinition);
    expect(script).toMatchSnapshot();
  });
});

describe('generateZshScript', () => {
  it('zsh補完スクリプトを生成する', () => {
    const script = generateZshScript(completionDefinition);
    expect(script).toContain('#compdef gwm');
    expect(script).toContain('_gwm');
    expect(script).toContain('gwm completion __complete');
    expect(script).toContain('_describe');
  });

  it('スナップショットが安定している', () => {
    const script = generateZshScript(completionDefinition);
    expect(script).toMatchSnapshot();
  });
});

describe('generateFishScript', () => {
  it('fish補完スクリプトを生成する', () => {
    const script = generateFishScript(completionDefinition);
    expect(script).toContain('__gwm_complete');
    expect(script).toContain('complete -c gwm');
    expect(script).toContain('gwm completion __complete');
  });

  it('サブコマンドの静的補完が含まれる', () => {
    const script = generateFishScript(completionDefinition);
    expect(script).toContain('list');
    expect(script).toContain('add');
    expect(script).toContain('go');
  });

  it('スナップショットが安定している', () => {
    const script = generateFishScript(completionDefinition);
    expect(script).toMatchSnapshot();
  });
});

describe('generateShellScript', () => {
  it('bash を指定すると bash スクリプトを返す', () => {
    const script = generateShellScript('bash');
    expect(script).toContain('#!/bin/bash');
  });

  it('zsh を指定すると zsh スクリプトを返す', () => {
    const script = generateShellScript('zsh');
    expect(script).toContain('#compdef gwm');
  });

  it('fish を指定すると fish スクリプトを返す', () => {
    const script = generateShellScript('fish');
    expect(script).toContain('complete -c gwm');
  });
});
