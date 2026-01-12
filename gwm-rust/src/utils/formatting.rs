//! フォーマットユーティリティ
//!
//! 日時の相対時間表示などのフォーマット機能を提供します。

use chrono::{DateTime, Utc};

/// ISO8601形式の日時を相対時間文字列に変換
///
/// # Example
/// ```ignore
/// let time = "2024-01-15T10:30:00+00:00";
/// let relative = format_relative_time(time);
/// // => "2 hours ago", "3 days ago", etc.
/// ```
///
/// # Returns
/// - 相対時間文字列（"2 hours ago", "1 day ago" など）
/// - パース失敗時は元の文字列をそのまま返す
pub fn format_relative_time(date_string: &str) -> String {
    let parsed = DateTime::parse_from_rfc3339(date_string)
        .or_else(|_| DateTime::parse_from_str(date_string, "%Y-%m-%dT%H:%M:%S%z"));

    match parsed {
        Ok(dt) => {
            let now = Utc::now();
            let diff = now.signed_duration_since(dt.with_timezone(&Utc));

            let seconds = diff.num_seconds();
            let minutes = diff.num_minutes();
            let hours = diff.num_hours();
            let days = diff.num_days();
            let weeks = days / 7;
            let months = days / 30;
            let years = days / 365;

            if seconds < 0 {
                // 未来の日時
                "just now".to_string()
            } else if seconds < 60 {
                if seconds == 1 {
                    "1 second ago".to_string()
                } else {
                    format!("{} seconds ago", seconds)
                }
            } else if minutes < 60 {
                if minutes == 1 {
                    "1 minute ago".to_string()
                } else {
                    format!("{} minutes ago", minutes)
                }
            } else if hours < 24 {
                if hours == 1 {
                    "1 hour ago".to_string()
                } else {
                    format!("{} hours ago", hours)
                }
            } else if days < 7 {
                if days == 1 {
                    "1 day ago".to_string()
                } else {
                    format!("{} days ago", days)
                }
            } else if weeks < 4 {
                if weeks == 1 {
                    "1 week ago".to_string()
                } else {
                    format!("{} weeks ago", weeks)
                }
            } else if months < 12 {
                if months == 1 {
                    "1 month ago".to_string()
                } else {
                    format!("{} months ago", months)
                }
            } else if years == 1 {
                "1 year ago".to_string()
            } else {
                format!("{} years ago", years)
            }
        }
        Err(_) => date_string.to_string(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::Duration;

    #[test]
    fn test_format_relative_time_invalid() {
        assert_eq!(format_relative_time("invalid"), "invalid");
        assert_eq!(format_relative_time("not-a-date"), "not-a-date");
    }

    #[test]
    fn test_format_relative_time_seconds() {
        let now = Utc::now();
        let past = now - Duration::seconds(30);
        let date_str = past.to_rfc3339();
        let result = format_relative_time(&date_str);
        assert!(result.contains("seconds ago") || result.contains("second ago"));
    }

    #[test]
    fn test_format_relative_time_minutes() {
        let now = Utc::now();
        let past = now - Duration::minutes(5);
        let date_str = past.to_rfc3339();
        let result = format_relative_time(&date_str);
        assert!(result.contains("minutes ago"));
    }

    #[test]
    fn test_format_relative_time_hours() {
        let now = Utc::now();
        let past = now - Duration::hours(3);
        let date_str = past.to_rfc3339();
        let result = format_relative_time(&date_str);
        assert!(result.contains("hours ago"));
    }

    #[test]
    fn test_format_relative_time_days() {
        let now = Utc::now();
        let past = now - Duration::days(2);
        let date_str = past.to_rfc3339();
        let result = format_relative_time(&date_str);
        assert!(result.contains("days ago"));
    }

    #[test]
    fn test_format_relative_time_weeks() {
        let now = Utc::now();
        let past = now - Duration::weeks(2);
        let date_str = past.to_rfc3339();
        let result = format_relative_time(&date_str);
        assert!(result.contains("weeks ago"));
    }
}
