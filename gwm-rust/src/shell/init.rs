//! Shell integration script generator.
//!
//! `gwm init <shell>` outputs a shell function that wraps the `gwm` binary and
//! performs `cd` when `gwm add` / `gwm go` outputs a single absolute path.

use crate::cli::ShellType;
use crate::error::Result;
use crate::shell::escape_shell_arg;

/// Generate and print shell integration script to stdout.
pub fn run_init(shell: ShellType) -> Result<()> {
    let gwm_bin = std::env::current_exe()
        .ok()
        .and_then(|p| p.to_str().map(|s| s.to_string()));
    print!("{}", generate(shell, gwm_bin.as_deref()));
    Ok(())
}

/// Generate shell integration script.
pub fn generate(shell: ShellType, gwm_bin: Option<&str>) -> String {
    match shell {
        ShellType::Bash => bash_zsh_template("bash", "~/.bashrc", gwm_bin),
        ShellType::Zsh => bash_zsh_template("zsh", "~/.zshrc", gwm_bin),
        ShellType::Fish => fish_template(gwm_bin),
    }
}

fn bash_zsh_template(shell: &str, rc_file: &str, gwm_bin: Option<&str>) -> String {
    let gwm_bin_expr = match gwm_bin {
        Some(path) => escape_shell_arg(path),
        None => "'gwm'".to_string(),
    };
    format!(
        r#"# gwm shell integration
# Add to your {rc_file}:
#   eval "$(gwm init {shell})"

unalias gwm 2>/dev/null

gwm() {{
    local exit_code
    local gwm_bin={gwm_bin_expr}

    # For commands other than add/go, run normally
    if [[ $# -eq 0 ]]; then
        "$gwm_bin"
        return $?
    fi

    if [[ "$1" != "add" && "$1" != "go" ]]; then
        "$gwm_bin" "$@"
        return $?
    fi

    # add: use temp files for cwd and hooks (hooks run after cd)
    # go: use temp file for cwd only (no hooks)
    local cwd_file hooks_file target
    cwd_file="$(mktemp -t gwm-cwd.XXXXXX 2>/dev/null || mktemp 2>/dev/null || mktemp /tmp/gwm-cwd.XXXXXX 2>/dev/null)"

    if [[ "$1" == "add" ]]; then
        hooks_file="$(mktemp -t gwm-hooks.XXXXXX 2>/dev/null || mktemp 2>/dev/null || mktemp /tmp/gwm-hooks.XXXXXX 2>/dev/null)"
    fi

    if [[ -n "$cwd_file" ]]; then
        if [[ -n "$hooks_file" ]]; then
            GWM_CWD_FILE="$cwd_file" GWM_HOOKS_FILE="$hooks_file" "$gwm_bin" "$@"
        else
            GWM_CWD_FILE="$cwd_file" "$gwm_bin" "$@"
        fi
        exit_code=$?
    else
        "$gwm_bin" "$@"
        exit_code=$?
        [[ -n "$hooks_file" ]] && rm -f -- "$hooks_file" 2>/dev/null
        return $exit_code
    fi

    if [[ $exit_code -ne 0 ]]; then
        rm -f -- "$cwd_file" 2>/dev/null
        [[ -n "$hooks_file" ]] && rm -f -- "$hooks_file" 2>/dev/null
        return $exit_code
    fi

    if [[ -s "$cwd_file" ]]; then
        target="$(cat -- "$cwd_file")"
        rm -f -- "$cwd_file" 2>/dev/null

        if [[ -n "$target" && "$target" == /* && -d "$target" ]]; then
            builtin cd -- "$target" || {{
                [[ -n "$hooks_file" ]] && rm -f -- "$hooks_file" 2>/dev/null
                return 1
            }}

            # Run deferred hooks after cd completes (add command only)
            if [[ -n "$hooks_file" && -s "$hooks_file" ]]; then
                "$gwm_bin" add --run-deferred-hooks "$hooks_file"
            fi
            [[ -n "$hooks_file" ]] && rm -f -- "$hooks_file" 2>/dev/null
            return 0
        fi

        # Fallback: print target if present
        if [[ -n "$target" ]]; then
            printf '%s\n' "$target"
        fi
        [[ -n "$hooks_file" ]] && rm -f -- "$hooks_file" 2>/dev/null
        return 0
    fi

    rm -f -- "$cwd_file" 2>/dev/null
    [[ -n "$hooks_file" ]] && rm -f -- "$hooks_file" 2>/dev/null
    return 0
}}
"#
    )
}

fn fish_template(gwm_bin: Option<&str>) -> String {
    let gwm_bin_expr = match gwm_bin {
        Some(path) => escape_shell_arg(path),
        None => "'gwm'".to_string(),
    };

    format!(
        r#"# gwm shell integration
# Add to your ~/.config/fish/config.fish:
#   gwm init fish | source

functions -e gwm 2>/dev/null

function gwm --wraps='command gwm' --description 'Git Worktree Manager'
    set -l gwm_bin {gwm_bin_expr}

    if test (count $argv) -eq 0
        $gwm_bin
        return $status
    end

    switch $argv[1]
        case add
            # add: use temp files for cwd and hooks (hooks run after cd)
            set -l cwd_file (mktemp -t gwm-cwd.XXXXXX 2>/dev/null; or mktemp 2>/dev/null; or mktemp /tmp/gwm-cwd.XXXXXX 2>/dev/null)
            set -l hooks_file (mktemp -t gwm-hooks.XXXXXX 2>/dev/null; or mktemp 2>/dev/null; or mktemp /tmp/gwm-hooks.XXXXXX 2>/dev/null)

            if test -n "$cwd_file"
                env GWM_CWD_FILE="$cwd_file" GWM_HOOKS_FILE="$hooks_file" $gwm_bin $argv
            else
                $gwm_bin $argv
                test -n "$hooks_file"; and rm -f -- "$hooks_file" 2>/dev/null
                return $status
            end
            set -l exit_code $status

            if test $exit_code -ne 0
                test -n "$cwd_file"; and rm -f -- "$cwd_file" 2>/dev/null
                test -n "$hooks_file"; and rm -f -- "$hooks_file" 2>/dev/null
                return $exit_code
            end

            if test -n "$cwd_file"; and test -s "$cwd_file"
                set -l target (cat -- "$cwd_file")
                rm -f -- "$cwd_file" 2>/dev/null

                if test -n "$target"
                    if string match -q '/*' -- $target; and test -d "$target"
                        builtin cd -- "$target"
                        set -l cd_status $status
                        if test $cd_status -ne 0
                            test -n "$hooks_file"; and rm -f -- "$hooks_file" 2>/dev/null
                            return $cd_status
                        end

                        # Run deferred hooks after cd completes
                        if test -n "$hooks_file"; and test -s "$hooks_file"
                            $gwm_bin add --run-deferred-hooks "$hooks_file"
                        end
                        test -n "$hooks_file"; and rm -f -- "$hooks_file" 2>/dev/null
                        return 0
                    end
                    printf '%s\n' $target
                end
                test -n "$hooks_file"; and rm -f -- "$hooks_file" 2>/dev/null
                return 0
            end

            test -n "$cwd_file"; and rm -f -- "$cwd_file" 2>/dev/null
            test -n "$hooks_file"; and rm -f -- "$hooks_file" 2>/dev/null
            return 0

        case go
            # go: use temp file for cwd only (no hooks)
            set -l cwd_file (mktemp -t gwm-cwd.XXXXXX 2>/dev/null; or mktemp 2>/dev/null; or mktemp /tmp/gwm-cwd.XXXXXX 2>/dev/null)

            if test -n "$cwd_file"
                env GWM_CWD_FILE="$cwd_file" $gwm_bin $argv
            else
                $gwm_bin $argv
                return $status
            end
            set -l exit_code $status

            if test $exit_code -ne 0
                test -n "$cwd_file"; and rm -f -- "$cwd_file" 2>/dev/null
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
                    printf '%s\n' $target
                end
                return 0
            end

            test -n "$cwd_file"; and rm -f -- "$cwd_file" 2>/dev/null
            return 0

        case '*'
            $gwm_bin $argv
            return $status
    end
end
"#
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_generate_bash() {
        let script = generate(ShellType::Bash, Some("/path/to/gwm"));
        assert!(script.contains(r#"eval "$(gwm init bash)""#));
        assert!(script.contains("unalias gwm"));
        assert!(script.contains("gwm()"));
        assert!(script.contains("local gwm_bin='/path/to/gwm'"));
        assert!(script.contains("GWM_CWD_FILE"));
        assert!(script.contains("GWM_HOOKS_FILE"));
        assert!(script.contains(r#"if [[ "$1" != "add" && "$1" != "go" ]]; then"#));
        assert!(script.contains(r#"builtin cd -- "$target""#));
        assert!(script.contains("--run-deferred-hooks"));
    }

    #[test]
    fn test_generate_zsh() {
        let script = generate(ShellType::Zsh, Some("/path/to/gwm"));
        assert!(script.contains(r#"eval "$(gwm init zsh)""#));
        assert!(script.contains("gwm()"));
        assert!(script.contains("GWM_HOOKS_FILE"));
        assert!(script.contains("--run-deferred-hooks"));
    }

    #[test]
    fn test_generate_fish() {
        let script = generate(ShellType::Fish, Some("/path/to/gwm"));
        assert!(script.contains("gwm init fish | source"));
        assert!(script.contains("function gwm"));
        assert!(script.contains("switch $argv[1]"));
        assert!(script.contains("case add"));
        assert!(script.contains("case go"));
        assert!(script.contains("set -l gwm_bin '/path/to/gwm'"));
        assert!(script.contains("GWM_CWD_FILE"));
        assert!(script.contains("GWM_HOOKS_FILE"));
        assert!(script.contains("--run-deferred-hooks"));
    }
}
