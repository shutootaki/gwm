export interface AddArgs {
  branchName?: string;
  isRemote: boolean;
  fromBranch?: string;
  openCode: boolean;
  openCursor: boolean;
  outputPath: boolean;
}

export interface RemoveArgs {
  query?: string;
  force: boolean;
  cleanBranch?: 'auto' | 'ask' | 'never';
}

export interface CleanArgs {
  yes: boolean;
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface PullMainArgs {
  // 将来の拡張用 (例: --remote=origin)
}

function hasFlag(args: string[], flags: string[]): boolean {
  return flags.some((f) => args.includes(f));
}

function getOptionValue(args: string[], option: string): string | undefined {
  const index = args.indexOf(option);
  return index !== -1 && index + 1 < args.length ? args[index + 1] : undefined;
}

function getFirstPositional(args: string[], skip = 1): string | undefined {
  return args.slice(skip).find((a) => !a.startsWith('-'));
}

export function parseAddArgs(args: string[]): AddArgs {
  let branchName: string | undefined;
  const isRemote = hasFlag(args, ['-r', '--remote']);
  const fromBranch = getOptionValue(args, '--from');
  const openCode = hasFlag(args, ['--code']);
  const openCursor = hasFlag(args, ['--cursor']);
  const outputPath = hasFlag(args, ['--cd']);

  // 位置引数（ブランチ名）は --from の値を除外した最初の非フラグ
  for (let i = 1; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--from') {
      i++; // 次は値なのでスキップ
      continue;
    }

    if (!arg.startsWith('-')) {
      branchName = arg;
      break;
    }
  }

  return { branchName, isRemote, fromBranch, openCode, openCursor, outputPath };
}

export function parseRemoveArgs(args: string[]): RemoveArgs {
  return {
    query: getFirstPositional(args, 1),
    force: hasFlag(args, ['-f', '--force']),
    cleanBranch: (() => {
      let raw = getOptionValue(args, '--clean-branch');
      if (!raw) {
        const withEq = args.find((a) => a.startsWith('--clean-branch='));
        if (withEq) {
          raw = withEq.split('=')[1];
        }
      }

      if (raw === 'auto' || raw === 'never') return raw;
      if (raw === 'ask') return 'ask';
      return undefined;
    })(),
  };
}

export function parseCleanArgs(args: string[]): CleanArgs {
  return { yes: hasFlag(args, ['-y', '--yes']) };
}

export function parseGoArgs(args: string[]): {
  query?: string;
  openCode: boolean;
  openCursor: boolean;
} {
  let query: string | undefined;
  let openCode = false;
  let openCursor = false;

  for (let i = 1; i < args.length; i++) {
    // start from 1 to skip 'go' command
    const arg = args[i];

    if (arg === '-c' || arg === '--code') {
      openCode = true;
    } else if (arg === '--cursor') {
      openCursor = true;
    } else if (!arg.startsWith('-') && !query) {
      // First non-flag argument is the query
      query = arg;
    }
  }

  return { query, openCode, openCursor };
}

export function parsePullMainArgs(_args: string[]): PullMainArgs {
  // 現在はオプションなし、将来の拡張用
  return {};
}

export function isHelpRequested(args: string[], command?: string): boolean {
  return args.includes('--help') || args.includes('-h') || command === 'help';
}
