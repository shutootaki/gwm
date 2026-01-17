export interface AddArgs {
  branchName?: string;
  isRemote: boolean;
  fromBranch?: string;
  openCode: boolean;
  openCursor: boolean;
  outputPath: boolean;
  noCd: boolean;
  skipHooks: boolean;
}

export interface RemoveArgs {
  query?: string;
  force: boolean;
  cleanBranch?: 'auto' | 'ask' | 'never';
}

export interface CleanArgs {
  dryRun: boolean;
  force: boolean;
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface PullMainArgs {
  // 将来の拡張用 (例: --remote=origin)
}

export interface HelpArgs {
  command?: string;
}

export interface InitArgs {
  shell: 'bash' | 'zsh' | 'fish';
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
  const isRemote = hasFlag(args, ['-r', '--remote']);
  const fromBranch = getOptionValue(args, '--from');
  const openCode = hasFlag(args, ['--code']);
  const openCursor = hasFlag(args, ['--cursor']);
  const noCd = hasFlag(args, ['--no-cd']);
  const skipHooks = hasFlag(args, ['--skip-hooks']);

  // outputPath: デフォルトでパス出力（--no-cd で無効化）
  // --cd は互換性のため残すが、デフォルトが true なので実質的に不要
  const outputPath = !noCd;

  // 位置引数（ブランチ名）は --from の値を除外した最初の非フラグ
  let branchName: string | undefined;
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

  return {
    branchName,
    isRemote,
    fromBranch,
    openCode,
    openCursor,
    outputPath,
    noCd,
    skipHooks,
  };
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

      if (raw === 'auto' || raw === 'ask' || raw === 'never') {
        return raw;
      }
      return undefined;
    })(),
  };
}

export function parseCleanArgs(args: string[]): CleanArgs {
  // 廃止されたオプションチェック
  if (hasFlag(args, ['-y', '--yes', '-i', '--interactive'])) {
    throw new Error(
      'Error: --yes/-y および --interactive/-i は廃止されました。代わりに --force を使用してください。'
    );
  }

  return {
    dryRun: hasFlag(args, ['-n', '--dry-run']),
    force: hasFlag(args, ['--force']),
  };
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

export function parseHelpArgs(args: string[]): HelpArgs {
  // help コマンドの後の最初の位置引数を取得
  const command = getFirstPositional(args, 1);
  return { command };
}

export function parseInitArgs(args: string[]): InitArgs {
  const shell = getFirstPositional(args, 1);
  if (shell === 'bash' || shell === 'zsh' || shell === 'fish') {
    return { shell };
  }

  throw new Error(
    `Error: invalid shell '${shell ?? ''}'. Valid shells: bash, zsh, fish`
  );
}

export function isHelpRequested(args: string[], command?: string): boolean {
  return args.includes('--help') || args.includes('-h') || command === 'help';
}
