export interface CreateArgs {
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

export function parseCreateArgs(args: string[]): CreateArgs {
  const flags = args.filter(arg => arg.startsWith('-'));
  const positional = args.filter(arg => !arg.startsWith('-'));
  
  const isRemote = flags.includes('-r') || flags.includes('--remote');
  const fromIndex = args.findIndex(arg => arg === '--from');
  const fromBranch = fromIndex !== -1 && fromIndex + 1 < args.length ? args[fromIndex + 1] : undefined;
  const branchName = positional[1]; // args[0] is 'create'
  
  return { branchName, isRemote, fromBranch };
}

export function parseRemoveArgs(args: string[]): RemoveArgs {
  const flags = args.filter(arg => arg.startsWith('-'));
  const positional = args.filter(arg => !arg.startsWith('-'));
  
  const force = flags.includes('-f') || flags.includes('--force');
  const query = positional[1]; // args[0] is 'remove' or 'rm'
  
  return { query, force };
}

export function parseCleanArgs(args: string[]): CleanArgs {
  const flags = args.filter(arg => arg.startsWith('-'));
  const yes = flags.includes('-y') || flags.includes('--yes');
  
  return { yes };
}

export function isHelpRequested(args: string[], command?: string): boolean {
  return args.includes('--help') || args.includes('-h') || command === 'help';
}