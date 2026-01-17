import { realpathSync } from 'fs';
import { isAbsolute, resolve } from 'path';
import { escapeShellArg } from './shell.js';

export type ShellType = 'bash' | 'zsh' | 'fish';

function toAbsolutePath(p: string): string {
  if (isAbsolute(p)) return p;
  return resolve(process.cwd(), p);
}

function tryRealpath(p: string): string {
  try {
    return realpathSync(p);
  } catch {
    return p;
  }
}

export function generateShellIntegrationScript(
  shell: ShellType,
  options: { nodePath: string; scriptPath: string }
): string {
  const nodePath = tryRealpath(toAbsolutePath(options.nodePath));
  const scriptPath = tryRealpath(toAbsolutePath(options.scriptPath));

  const nodeExpr = escapeShellArg(nodePath);
  const scriptExpr = escapeShellArg(scriptPath);

  if (shell === 'fish') {
    return fishTemplate(nodeExpr, scriptExpr);
  }

  const rcFile = shell === 'bash' ? '~/.bashrc' : '~/.zshrc';
  return bashZshTemplate(shell, rcFile, nodeExpr, scriptExpr);
}

function bashZshTemplate(
  shell: 'bash' | 'zsh',
  rcFile: string,
  nodeExpr: string,
  scriptExpr: string
): string {
  return `# gwm shell integration
# Add to your ${rcFile}:
#   eval "$(gwm init ${shell})"

unalias gwm 2>/dev/null

gwm() {
    local exit_code
    local gwm_node=${nodeExpr}
    local gwm_script=${scriptExpr}

    # For commands other than add/go, run normally
    if [[ $# -eq 0 ]]; then
        "$gwm_node" "$gwm_script"
        return $?
    fi

    if [[ "$1" != "add" && "$1" != "go" ]]; then
        "$gwm_node" "$gwm_script" "$@"
        return $?
    fi

    # add/go: run normally (keep stdout attached to TTY) and use a temp file for cwd
    local cwd_file target
    cwd_file="$(mktemp -t gwm-cwd.XXXXXX 2>/dev/null || mktemp 2>/dev/null || mktemp /tmp/gwm-cwd.XXXXXX 2>/dev/null)"

    if [[ -n "$cwd_file" ]]; then
        GWM_CWD_FILE="$cwd_file" "$gwm_node" "$gwm_script" "$@"
        exit_code=$?
    else
        "$gwm_node" "$gwm_script" "$@"
        exit_code=$?
        return $exit_code
    fi

    if [[ $exit_code -ne 0 ]]; then
        rm -f -- "$cwd_file" 2>/dev/null
        return $exit_code
    fi

    if [[ -s "$cwd_file" ]]; then
        target="$(cat -- "$cwd_file")"
        rm -f -- "$cwd_file" 2>/dev/null

        if [[ -n "$target" && "$target" == /* && -d "$target" ]]; then
            builtin cd -- "$target" || return 1
            return 0
        fi

        # Fallback: print target if present
        if [[ -n "$target" ]]; then
            printf '%s\n' "$target"
        fi
        return 0
    fi

    rm -f -- "$cwd_file" 2>/dev/null
    return 0
}
`;
}

function fishTemplate(nodeExpr: string, scriptExpr: string): string {
  return `# gwm shell integration
# Add to your ~/.config/fish/config.fish:
#   gwm init fish | source

functions -e gwm 2>/dev/null

function gwm --wraps='command gwm' --description 'Git Worktree Manager'
    set -l gwm_node ${nodeExpr}
    set -l gwm_script ${scriptExpr}

    if test (count $argv) -eq 0
        $gwm_node $gwm_script
        return $status
    end

    switch $argv[1]
        case add go
            set -l cwd_file (mktemp -t gwm-cwd.XXXXXX 2>/dev/null)
            if test -z "$cwd_file"
                set cwd_file (mktemp 2>/dev/null)
            end
            if test -z "$cwd_file"
                set cwd_file (mktemp /tmp/gwm-cwd.XXXXXX 2>/dev/null)
            end

            if test -n "$cwd_file"
                env GWM_CWD_FILE="$cwd_file" $gwm_node $gwm_script $argv
            else
                $gwm_node $gwm_script $argv
            end
            set -l exit_code $status

            if test $exit_code -ne 0
                if test -n "$cwd_file"
                    rm -f -- "$cwd_file" 2>/dev/null
                end
                return $exit_code
            end

            if test -n "$cwd_file"; and test -s "$cwd_file"
                set -l target (cat -- "$cwd_file")
                rm -f -- "$cwd_file" 2>/dev/null

                if test -n "$target"
                    if string match -q '/*' -- $target; and test -d "$target"
                        builtin cd -- "$target"
                        return $status
                    end
                    printf '%s\\n' $target
                end
                return 0
            end

            if test -n "$cwd_file"
                rm -f -- "$cwd_file" 2>/dev/null
            end
            return 0
        case '*'
            $gwm_node $gwm_script $argv
            return $status
    end
end
`;
}
