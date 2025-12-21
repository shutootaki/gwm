#!/usr/bin/env node
/**
 * 補完スクリプト生成スクリプト
 * ビルド時に dist/completions と dist/fig にスクリプトを生成する
 */

import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { generateBashScript } from '../dist/completion/generators/shell/bash.js';
import { generateZshScript } from '../dist/completion/generators/shell/zsh.js';
import { generateFishScript } from '../dist/completion/generators/shell/fish.js';
import { generateFigSpec } from '../dist/completion/generators/fig/spec.js';
import { completionDefinition } from '../dist/completion/definition.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const distDir = join(__dirname, '..', 'dist');
const completionsDir = join(distDir, 'completions');
const figDir = join(distDir, 'fig');

// ディレクトリ作成
mkdirSync(completionsDir, { recursive: true });
mkdirSync(figDir, { recursive: true });

// シェル補完スクリプト生成
console.log('Generating shell completion scripts...');

const bashScript = generateBashScript(completionDefinition);
writeFileSync(join(completionsDir, 'gwm.bash'), bashScript);
console.log('  ✓ dist/completions/gwm.bash');

const zshScript = generateZshScript(completionDefinition);
writeFileSync(join(completionsDir, '_gwm'), zshScript);
console.log('  ✓ dist/completions/_gwm');

const fishScript = generateFishScript(completionDefinition);
writeFileSync(join(completionsDir, 'gwm.fish'), fishScript);
console.log('  ✓ dist/completions/gwm.fish');

// Fig/Kiro spec 生成
console.log('Generating Fig/Kiro completion spec...');

const figSpec = generateFigSpec(completionDefinition);
writeFileSync(join(figDir, 'gwm.js'), figSpec);
console.log('  ✓ dist/fig/gwm.js');

console.log('');
console.log('Completion scripts generated successfully!');
