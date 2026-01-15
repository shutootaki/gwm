//! ANSI color code constants for terminal output.
//!
//! Provides shared color definitions used across the UI modules.

/// Green color for success messages.
pub const GREEN: &str = "\x1b[32m";

/// Red color for error messages.
pub const RED: &str = "\x1b[31m";

/// Yellow color for warning messages.
pub const YELLOW: &str = "\x1b[33m";

/// Cyan color for info messages.
pub const CYAN: &str = "\x1b[36m";

/// Gray/dim color for secondary information.
pub const DIM: &str = "\x1b[90m";

/// Reset color to default.
pub const RESET: &str = "\x1b[0m";

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_color_codes_are_valid_ansi() {
        // Verify each color code starts with escape sequence
        assert!(GREEN.starts_with("\x1b["));
        assert!(RED.starts_with("\x1b["));
        assert!(YELLOW.starts_with("\x1b["));
        assert!(CYAN.starts_with("\x1b["));
        assert!(DIM.starts_with("\x1b["));
        assert!(RESET.starts_with("\x1b["));
    }

    #[test]
    fn test_reset_ends_sequences() {
        // RESET should be the standard ANSI reset code
        assert_eq!(RESET, "\x1b[0m");
    }
}
