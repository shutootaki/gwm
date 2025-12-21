/**
 * completion サブコマンドのエントリーポイント
 */

// 内部コマンド
export { runInternalCommand } from './internal.js';

// script
export { parseScriptArgs, runScript, type ScriptArgs } from './script.js';

// install
export {
  parseInstallArgs,
  runInstall,
  type InstallArgs,
  type InstallResult,
} from './install.js';

// uninstall
export {
  parseUninstallArgs,
  runUninstall,
  type UninstallArgs,
  type UninstallResult,
} from './uninstall.js';

// status
export { getStatus, formatStatus, type StatusInfo } from './status.js';
