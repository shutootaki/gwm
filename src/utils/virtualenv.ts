import { existsSync, readdirSync, statSync } from 'fs';
import { join, relative, normalize, sep } from 'path';
import { loadConfig } from '../config.js';
import type { Config } from '../config.js';

export interface VirtualEnvPattern {
  language: string;
  patterns: string[];
  setupCommands: string[];
}

export interface DetectedVirtualEnv {
  language: string;
  path: string;
  pattern: string;
}

const DEFAULT_PATTERNS: VirtualEnvPattern[] = [
  {
    language: 'Python',
    patterns: [
      '.venv',
      'venv',
      '.virtualenv',
      'env',
      '.direnv',
      '.tox',
      '__pypackages__',
      '__pycache__',
    ],
    setupCommands: [
      'python -m venv .venv',
      'poetry install',
      'pipenv install',
      'conda env create',
    ],
  },
  {
    language: 'Node.js',
    patterns: [
      'node_modules',
      '.pnpm-store',
      '.yarn',
      '.yarn/cache',
      '.npm',
      '.nvm',
    ],
    setupCommands: ['npm install', 'pnpm install', 'yarn install'],
  },
  {
    language: 'Ruby',
    patterns: ['.bundle', 'vendor/bundle', 'vendor'],
    setupCommands: ['bundle install'],
  },
  {
    language: 'Rust',
    patterns: ['target'],
    setupCommands: ['cargo build'],
  },
  {
    language: 'Go',
    patterns: ['vendor'],
    setupCommands: ['go mod vendor', 'go mod download'],
  },
  {
    language: 'PHP',
    patterns: ['vendor'],
    setupCommands: ['composer install'],
  },
  {
    language: 'Java',
    patterns: ['.gradle', '.m2', 'build', 'target'],
    setupCommands: ['gradle build', 'mvn install'],
  },
  {
    language: 'Elixir',
    patterns: ['_build', 'deps'],
    setupCommands: ['mix deps.get', 'mix compile'],
  },
];

/**
 * パスを POSIX 形式（区切り記号を "/" に統一、先頭/末尾の "/" を削除）に正規化
 */
function normalizeToPosixPath(p: string): string {
  return normalize(p)
    .split(sep)
    .join('/')
    .replace(/^\/+|\/+$/g, '');
}
// カスタムパターンをマージ
function buildVirtualEnvPatterns(): VirtualEnvPattern[] {
  const cfg = loadConfig();
  const veh: Config['virtual_env_handling'] =
    cfg && typeof cfg === 'object'
      ? (cfg as Config).virtual_env_handling
      : undefined;

  const merged: VirtualEnvPattern[] = [...DEFAULT_PATTERNS];

  if (veh?.custom_patterns) {
    for (const cp of veh.custom_patterns) {
      merged.push({
        language: cp.language,
        patterns: cp.patterns,
        setupCommands: cp.commands ?? [],
      });
    }
  }

  return merged;
}

// NOTE: VIRTUAL_ENV_PATTERNS はテスト互換のため export するが、
// 毎回最新の設定を反映できるようリフレッシュ関数で中身を動的に入れ替える。
export const VIRTUAL_ENV_PATTERNS: VirtualEnvPattern[] =
  buildVirtualEnvPatterns();

/** 設定キャッシュの変更に追従してパターンを再構築 */
export function refreshVirtualEnvPatterns(): void {
  const updated = buildVirtualEnvPatterns();
  // 配列自体の参照を維持したまま内容を更新することで、既存 import 先も最新化する
  VIRTUAL_ENV_PATTERNS.splice(0, VIRTUAL_ENV_PATTERNS.length, ...updated);
}

function currentPatterns(): VirtualEnvPattern[] {
  refreshVirtualEnvPatterns();
  return VIRTUAL_ENV_PATTERNS;
}

// 走査を無視する重量ディレクトリ
const IGNORE_DIRS = new Set([
  '.git',
  '.hg',
  '.svn',
  '.idea',
  '.vscode',
  'dist',
  'build',
]);

/**
 * 指定したディレクトリ内の仮想環境を検出
 */
export function detectVirtualEnvs(directory: string): DetectedVirtualEnv[] {
  // 検出結果を言語 + パターン単位で一意にする
  const detected: DetectedVirtualEnv[] = [];
  const seenKey = new Set<string>();

  if (!existsSync(directory)) {
    return detected;
  }

  const cfg = loadConfig();
  const maxDepth =
    cfg?.virtual_env_handling?.max_scan_depth !== undefined
      ? cfg.virtual_env_handling.max_scan_depth === -1
        ? Number.MAX_SAFE_INTEGER
        : cfg.virtual_env_handling.max_scan_depth
      : 5; // 既定値

  function walk(dir: string, depth: number) {
    if (depth < 0) return;

    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch {
      return;
    }

    for (const entry of entries) {
      if (IGNORE_DIRS.has(entry)) continue; // 重量ディレクトリは無視

      const fullPath = join(dir, entry);

      let stat;
      try {
        stat = statSync(fullPath);
      } catch {
        continue;
      }

      if (!stat.isDirectory()) continue;

      // 同じエントリが複数言語パターンに一致しうるので break しない
      let anyMatched = false;
      const relFromRoot = normalizeToPosixPath(relative(directory, fullPath));

      for (const envPattern of currentPatterns()) {
        for (const pattern of envPattern.patterns) {
          const patternPosix = normalizeToPosixPath(pattern);

          // 1) パターンが dir 名のみの場合 → entry と一致すればマッチ
          // 2) パターンにスラッシュを含む場合 → ルートからの相対パスが pattern で始まればマッチ

          const isMatch = patternPosix.includes('/')
            ? relFromRoot.startsWith(patternPosix)
            : entry === patternPosix;

          if (isMatch) {
            // 言語 + パターン + パスの組み合わせで一意にすることで、
            // 同一言語・同一パターンでも複数の場所に存在する場合はすべて報告する
            const key = `${envPattern.language}::${patternPosix}::${relFromRoot || entry}`;
            if (!seenKey.has(key)) {
              detected.push({
                language: envPattern.language,
                path: relFromRoot || entry,
                pattern: patternPosix,
              });
              seenKey.add(key);
            }
            anyMatched = true;
            // そのパターン集合内で複数マッチしても意味はないので break
            break;
          }
        }
      }

      // パターン一致した場合でも、さらにそのディレクトリ配下を探索する必要はない
      if (anyMatched) {
        continue;
      }

      walk(fullPath, depth - 1);
    }
  }

  walk(directory, maxDepth);

  return detected;
}

/**
 * 検出された仮想環境に基づいてセットアップコマンドを提案
 */
export function suggestSetupCommands(
  detectedEnvs: DetectedVirtualEnv[]
): string[] {
  const suggestions: string[] = [];
  const seenLanguages = new Set<string>();

  for (const env of detectedEnvs) {
    if (seenLanguages.has(env.language)) continue;
    seenLanguages.add(env.language);

    const pattern = currentPatterns().find((p) => p.language === env.language);
    if (pattern) {
      suggestions.push(
        `# ${env.language}: Choose one of the following:`,
        ...pattern.setupCommands.map((cmd) => `  ${cmd}`)
      );
    }
  }

  return suggestions;
}

/**
 * パスが仮想環境かどうかチェック
 */
export function isVirtualEnv(targetPath: string): boolean {
  const posixPath = normalizeToPosixPath(targetPath).toLowerCase();
  const segments = posixPath.split('/');

  for (const envPattern of currentPatterns()) {
    for (const rawPattern of envPattern.patterns) {
      const patternPosix = normalizeToPosixPath(rawPattern).toLowerCase();

      // サブディレクトリを含むパターン ("vendor/bundle" など)
      if (patternPosix.includes('/')) {
        // ルートからのパスが完全一致または前方一致 ("vendor/bundle", "vendor/bundle/...")
        if (
          posixPath === patternPosix ||
          posixPath.startsWith(`${patternPosix}/`)
        ) {
          return true;
        }
        continue;
      }

      // ディレクトリ名単体パターンはセグメント完全一致
      if (segments.includes(patternPosix)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * 仮想環境パターンを除外パターンとして取得
 */
export function getVirtualEnvExcludePatterns(): string[] {
  const patterns = new Set<string>();

  for (const envPattern of currentPatterns()) {
    for (const pattern of envPattern.patterns) {
      patterns.add(pattern);
    }
  }

  return Array.from(patterns);
}
