export interface AddArgs {
  branchName?: string;
  isRemote: boolean;
  fromBranch?: string;
}

export interface RemoveArgs {
  query?: string;
  force: boolean;
}

export interface CleanArgs {
  yes: boolean;
}

export function parseAddArgs(args: string[]): AddArgs {
  let branchName: string | undefined;
  let isRemote = false;
  let fromBranch: string | undefined;

  for (let i = 1; i < args.length; i++) {
    // start from 1 to skip 'add' command
    const arg = args[i];

    if (arg === '-r' || arg === '--remote') {
      isRemote = true;
    } else if (arg === '--from') {
      if (i + 1 < args.length) {
        fromBranch = args[i + 1];
        i++; // skip next argument as it's the value for --from
      }
    } else if (!arg.startsWith('-') && !branchName) {
      // First non-flag argument is the branch name
      branchName = arg;
    }
  }

  return { branchName, isRemote, fromBranch };
}

export function parseRemoveArgs(args: string[]): RemoveArgs {
  let query: string | undefined;
  let force = false;

  for (let i = 1; i < args.length; i++) {
    // start from 1 to skip 'remove'/'rm' command
    const arg = args[i];

    if (arg === '-f' || arg === '--force') {
      force = true;
    } else if (!arg.startsWith('-') && !query) {
      // First non-flag argument is the query
      query = arg;
    }
  }

  return { query, force };
}

export function parseCleanArgs(args: string[]): CleanArgs {
  let yes = false;

  for (let i = 1; i < args.length; i++) {
    // start from 1 to skip 'clean' command
    const arg = args[i];

    if (arg === '-y' || arg === '--yes') {
      yes = true;
    }
  }

  return { yes };
}

export function isHelpRequested(args: string[], command?: string): boolean {
  return args.includes('--help') || args.includes('-h') || command === 'help';
}
