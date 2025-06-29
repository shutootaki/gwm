#!/usr/bin/env node
/* eslint-env node */
/* eslint-disable no-undef */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

(async () => {
    // リポジトリルート (scripts から 1 つ上)
    const root = path.join(fileURLToPath(new URL('..', import.meta.url)));

    // 必ず存在していて欲しいトップレベルファイル
    const required = ['LICENSE', 'README.md'];

    try {
        for (const file of required) {
            await fs.access(path.join(root, file));
        }
    } catch (err) {
        console.error(`❌ Missing required file: ${err.path}`);
        process.exit(1);
    }

    // dist が存在し、最低 1 ファイル含むか確認
    try {
        const distPath = path.join(root, 'dist');
        const files = await fs.readdir(distPath);
        if (!files.length) throw new Error('dist is empty');
    } catch (err) {
        console.error(`❌ Build artifacts not found in dist/. Did you run "pnpm run build"? Error: ${err.message}`);
        process.exit(1);
    }

    console.log('✅ Prepublish checks passed');
})(); 
