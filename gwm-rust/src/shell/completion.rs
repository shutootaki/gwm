//! Shell completion script generator.
//!
//! Generates shell completion scripts for bash, zsh, and fish.
//! Supports both static (clap-based) and dynamic (runtime) completion.

use clap::CommandFactory;
use clap_complete::{generate, Shell};

use crate::cli::{Cli, CompletionShell, ShellType};
use crate::error::Result;
use crate::shell::get_gwm_bin_expr;

/// Editor options for completion (code, cursor, zed).
const EDITOR_OPTIONS: &str = "code cursor zed";

/// Generate and print shell completion script to stdout.
///
/// # Arguments
/// * `shell` - Target shell type
/// * `with_dynamic` - Enable dynamic completion for worktree names
pub fn run_completion(shell: CompletionShell, with_dynamic: bool) -> Result<()> {
    let script = generate_completion(shell, with_dynamic);
    print!("{}", script);
    Ok(())
}

/// Generate completion script string.
fn generate_completion(shell: CompletionShell, with_dynamic: bool) -> String {
    match shell {
        CompletionShell::Bash => generate_bash(with_dynamic),
        CompletionShell::Zsh => generate_zsh(with_dynamic),
        CompletionShell::Fish => generate_fish(with_dynamic),
    }
}

/// Generate dynamic completion script for shell integration.
///
/// This function is called by `gwm init` to include completion
/// in the shell integration output. Always uses dynamic completion.
pub fn generate_for_shell_type(shell: ShellType) -> String {
    match shell {
        ShellType::Bash => generate_bash(true),
        ShellType::Zsh => generate_zsh(true),
        ShellType::Fish => generate_fish(true),
    }
}

/// Generate static completion using clap_complete
fn generate_static_completion(shell: Shell) -> String {
    let mut cmd = Cli::command();
    let mut buf = Vec::new();
    generate(shell, &mut cmd, "gwm", &mut buf);
    String::from_utf8(buf).unwrap_or_default()
}

/// Generate Bash completion script.
fn generate_bash(with_dynamic: bool) -> String {
    if with_dynamic {
        generate_bash_dynamic()
    } else {
        generate_static_completion(Shell::Bash)
    }
}

/// Generate Bash dynamic completion script.
fn generate_bash_dynamic() -> String {
    let gwm_bin = get_gwm_bin_expr();

    format!(
        r#"# gwm - Git Worktree Manager completion script (with dynamic completion)

_gwm_worktrees() {{
    local gwm_bin={gwm_bin}
    "$gwm_bin" list --format=names 2>/dev/null
}}

_gwm_branches() {{
    git branch --format='%(refname:short)' 2>/dev/null
}}

_gwm() {{
    local cur="${{COMP_WORDS[COMP_CWORD]}}"
    local prev="${{COMP_WORDS[COMP_CWORD-1]}}"
    local cmd="${{COMP_WORDS[1]}}"

    # First argument: subcommand
    if [[ $COMP_CWORD -eq 1 ]]; then
        COMPREPLY=($(compgen -W "add go init list ls sync remove rm clean completion help" -- "$cur"))
        return 0
    fi

    # Handle subcommand-specific completions
    case "$cmd" in
        go)
            case "$prev" in
                -o|--open)
                    COMPREPLY=($(compgen -W "{EDITOR_OPTIONS}" -- "$cur"))
                    return 0
                    ;;
                *)
                    if [[ "$cur" == -* ]]; then
                        COMPREPLY=($(compgen -W "-o --open" -- "$cur"))
                    else
                        local worktrees
                        worktrees=$(_gwm_worktrees)
                        COMPREPLY=($(compgen -W "$worktrees" -- "$cur"))
                    fi
                    return 0
                    ;;
            esac
            ;;
        remove|rm)
            if [[ "$cur" == -* ]]; then
                COMPREPLY=($(compgen -W "-f --force" -- "$cur"))
            else
                local worktrees
                worktrees=$(_gwm_worktrees)
                COMPREPLY=($(compgen -W "$worktrees" -- "$cur"))
            fi
            return 0
            ;;
        add)
            case "$prev" in
                -f|--from)
                    local branches
                    branches=$(_gwm_branches)
                    COMPREPLY=($(compgen -W "$branches" -- "$cur"))
                    return 0
                    ;;
                -o|--open)
                    COMPREPLY=($(compgen -W "{EDITOR_OPTIONS}" -- "$cur"))
                    return 0
                    ;;
                *)
                    if [[ "$cur" == -* ]]; then
                        COMPREPLY=($(compgen -W "-f --from -o --open" -- "$cur"))
                    fi
                    return 0
                    ;;
            esac
            ;;
        list|ls)
            if [[ "$cur" == -* ]]; then
                COMPREPLY=($(compgen -W "-c --compact --format" -- "$cur"))
            elif [[ "$prev" == "--format" ]]; then
                COMPREPLY=($(compgen -W "table json names" -- "$cur"))
            fi
            return 0
            ;;
        clean)
            if [[ "$cur" == -* ]]; then
                COMPREPLY=($(compgen -W "-f --force -n --dry-run" -- "$cur"))
            fi
            return 0
            ;;
        init|completion)
            if [[ "$cur" == -* ]]; then
                if [[ "$cmd" == "completion" ]]; then
                    COMPREPLY=($(compgen -W "--with-dynamic" -- "$cur"))
                fi
            else
                COMPREPLY=($(compgen -W "bash zsh fish" -- "$cur"))
            fi
            return 0
            ;;
        help)
            COMPREPLY=($(compgen -W "add go init list sync remove clean completion" -- "$cur"))
            return 0
            ;;
    esac
}}

complete -F _gwm gwm
"#
    )
}

/// Generate Zsh completion script.
fn generate_zsh(with_dynamic: bool) -> String {
    if with_dynamic {
        generate_zsh_dynamic()
    } else {
        generate_static_completion(Shell::Zsh)
    }
}

/// Generate Zsh dynamic completion script.
fn generate_zsh_dynamic() -> String {
    let gwm_bin = get_gwm_bin_expr();

    format!(
        r##"#compdef gwm

# gwm - Git Worktree Manager completion script (with dynamic completion)

_gwm_worktrees() {{
    local gwm_bin={gwm_bin}
    local -a worktrees
    worktrees=(${{(f)"$("$gwm_bin" list --format=names 2>/dev/null)"}})
    if [[ $#worktrees -gt 0 ]]; then
        _describe -t worktrees 'worktree' worktrees
    fi
}}

_gwm_branches() {{
    local -a branches
    branches=(${{(f)"$(git branch --format='%(refname:short)' 2>/dev/null)"}})
    if [[ $#branches -gt 0 ]]; then
        _describe -t branches 'branch' branches
    fi
}}

_gwm_editors() {{
    local -a editors
    editors=(
        'code:Visual Studio Code'
        'cursor:Cursor'
        'zed:Zed'
    )
    _describe -t editors 'editor' editors
}}

_gwm_shells() {{
    local -a shells
    shells=(bash zsh fish)
    _describe -t shells 'shell' shells
}}

_gwm() {{
    local context state state_descr line
    typeset -A opt_args

    _arguments -C \
        '1: :->command' \
        '*:: :->args'

    case $state in
        command)
            local -a commands
            commands=(
                'add:Create a new worktree'
                'go:Go to a worktree directory or open it in an editor'
                'init:Print shell integration script'
                'list:List all worktrees for the current project'
                'ls:List all worktrees (alias for list)'
                'sync:Update the main branch worktrees'
                'remove:Remove one or more worktrees'
                'rm:Remove worktrees (alias for remove)'
                'clean:Clean up safe-to-delete worktrees'
                'completion:Generate shell completion scripts'
                'help:Show help for gwm or a specific command'
            )
            _describe -t commands 'gwm command' commands
            ;;
        args)
            case $words[1] in
                go)
                    _arguments \
                        '(-o --open)'{{-o,--open}}'[Open in editor]:editor:_gwm_editors' \
                        '1: :_gwm_worktrees'
                    ;;
                remove|rm)
                    _arguments \
                        '(-f --force)'{{-f,--force}}'[Force removal without confirmation]' \
                        '*: :_gwm_worktrees'
                    ;;
                add)
                    _arguments \
                        '(-f --from)'{{-f,--from}}'[Base branch]:branch:_gwm_branches' \
                        '(-o --open)'{{-o,--open}}'[Open in editor after creation]:editor:_gwm_editors' \
                        '1:branch name:'
                    ;;
                list|ls)
                    _arguments \
                        '(-c --compact)'{{-c,--compact}}'[Compact output]' \
                        '--format[Output format]:(table json names)'
                    ;;
                clean)
                    _arguments \
                        '(-f --force)'{{-f,--force}}'[Force cleanup without confirmation]' \
                        '(-n --dry-run)'{{-n,--dry-run}}'[Show what would be deleted]'
                    ;;
                init)
                    _arguments \
                        '1:shell:_gwm_shells'
                    ;;
                completion)
                    _arguments \
                        '--with-dynamic[Enable dynamic completion]' \
                        '1:shell:_gwm_shells'
                    ;;
                help)
                    local -a help_topics
                    help_topics=(add go init list sync remove clean completion)
                    _describe -t topics 'topic' help_topics
                    ;;
            esac
            ;;
    esac
}}

# Register the completion function (required for eval)
compdef _gwm gwm
"##
    )
}

/// Generate Fish completion script.
fn generate_fish(with_dynamic: bool) -> String {
    let static_completion = generate_static_completion(Shell::Fish);

    if !with_dynamic {
        return static_completion;
    }

    let gwm_bin = get_gwm_bin_expr();

    format!(
        r#"{static_completion}

# Dynamic completion for gwm (worktree names)
function __gwm_worktrees
    set -l gwm_bin {gwm_bin}
    $gwm_bin list --format=names 2>/dev/null
end

function __gwm_branches
    git branch --format='%(refname:short)' 2>/dev/null
end

# Add dynamic completion for go and remove commands
complete -c gwm -n "__fish_seen_subcommand_from go" -f -a "(__gwm_worktrees)"
complete -c gwm -n "__fish_seen_subcommand_from remove rm" -f -a "(__gwm_worktrees)"
complete -c gwm -n "__fish_contains_opt from" -f -a "(__gwm_branches)"
complete -c gwm -n "__fish_contains_opt o open" -f -a "{EDITOR_OPTIONS}"
"#
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_generate_bash_static() {
        let script = generate_bash(false);
        assert!(script.contains("_gwm"));
        // 静的補完には動的ワークツリー関数は含まれない
        assert!(!script.contains("_gwm_worktrees"));
    }

    #[test]
    fn test_generate_bash_dynamic() {
        let script = generate_bash(true);
        // 動的補完には worktree 取得関数が含まれる
        assert!(script.contains("_gwm_worktrees"));
        assert!(script.contains("list --format=names"));
        // complete -F _gwm gwm の形式
        assert!(script.contains("complete -F _gwm gwm"));
    }

    #[test]
    fn test_generate_zsh_static() {
        let script = generate_zsh(false);
        assert!(script.contains("#compdef gwm"));
    }

    #[test]
    fn test_generate_zsh_dynamic() {
        let script = generate_zsh(true);
        assert!(script.contains("_gwm_worktrees"));
        assert!(script.contains("list --format=names"));
    }

    #[test]
    fn test_generate_fish_static() {
        let script = generate_fish(false);
        assert!(script.contains("complete -c gwm"));
    }

    #[test]
    fn test_generate_fish_dynamic() {
        let script = generate_fish(true);
        assert!(script.contains("__gwm_worktrees"));
        assert!(script.contains("list --format=names"));
    }

    #[test]
    fn test_run_completion_bash() {
        // Should not panic
        let result = run_completion(CompletionShell::Bash, false);
        assert!(result.is_ok());
    }

    #[test]
    fn test_run_completion_zsh_with_dynamic() {
        // Should not panic
        let result = run_completion(CompletionShell::Zsh, true);
        assert!(result.is_ok());
    }

    #[test]
    fn test_generate_for_shell_type() {
        use crate::cli::ShellType;

        // All shells should produce dynamic completion
        let bash = generate_for_shell_type(ShellType::Bash);
        assert!(bash.contains("_gwm_worktrees"));
        assert!(bash.contains("complete -F _gwm gwm"));

        let zsh = generate_for_shell_type(ShellType::Zsh);
        assert!(zsh.contains("_gwm_worktrees"));
        assert!(zsh.contains("#compdef gwm"));

        let fish = generate_for_shell_type(ShellType::Fish);
        assert!(fish.contains("__gwm_worktrees"));
        assert!(fish.contains("complete -c gwm"));
    }
}
