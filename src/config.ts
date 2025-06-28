import { readFileSync, existsSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import TOML from '@ltd/j-toml';

export interface Config {
  worktree_base_path: string;
  main_branches: string[];
}

const DEFAULT_CONFIG: Config = {
  worktree_base_path: join(homedir(), 'git-worktrees'),
  main_branches: ['main', 'master', 'develop'],
};

export function loadConfig(): Config {
  const configPaths = [
    join(homedir(), '.config', 'gwm', 'config.toml'),
    join(homedir(), '.gwmrc'),
  ];

  for (const configPath of configPaths) {
    if (existsSync(configPath)) {
      try {
        const content = readFileSync(configPath, 'utf8');
        const parsed = TOML.parse(content) as Partial<Config>;

        return {
          worktree_base_path:
            parsed.worktree_base_path || DEFAULT_CONFIG.worktree_base_path,
          main_branches: parsed.main_branches || DEFAULT_CONFIG.main_branches,
        };
      } catch (error) {
        console.error(`Error reading config file ${configPath}:`, error);
        continue;
      }
    }
  }

  return DEFAULT_CONFIG;
}
