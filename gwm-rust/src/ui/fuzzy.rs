//! Fuzzy matching モジュール
//!
//! 検索入力に対するファジーマッチングを提供します。
//! skim と同じアルゴリズム（SkimMatcherV2）を使用し、
//! マッチ位置の取得とスコアリングを行います。

use fuzzy_matcher::skim::SkimMatcherV2;
use fuzzy_matcher::FuzzyMatcher;

/// fuzzy マッチ結果
#[derive(Debug, Clone)]
pub struct FuzzyMatch {
    /// マッチスコア（高いほど良いマッチ）
    pub score: i64,
    /// マッチした文字のインデックス（ハイライト用）
    pub indices: Vec<usize>,
}

/// パターンとテキストを fuzzy マッチ
///
/// # Arguments
///
/// * `pattern` - 検索パターン（ユーザー入力）
/// * `text` - マッチ対象のテキスト
///
/// # Returns
///
/// マッチした場合は `Some(FuzzyMatch)` を返す。
/// マッチしなかった場合は `None` を返す。
pub fn fuzzy_match(pattern: &str, text: &str) -> Option<FuzzyMatch> {
    if pattern.is_empty() {
        return None;
    }

    let matcher = SkimMatcherV2::default();
    matcher
        .fuzzy_indices(text, pattern)
        .map(|(score, indices)| FuzzyMatch { score, indices })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_fuzzy_match_basic() {
        let result = fuzzy_match("fauth", "feature/auth");
        assert!(result.is_some());
        let m = result.unwrap();
        assert!(m.score > 0);
        assert!(!m.indices.is_empty());
    }

    #[test]
    fn test_fuzzy_match_no_match() {
        let result = fuzzy_match("xyz", "feature/auth");
        assert!(result.is_none());
    }

    #[test]
    fn test_fuzzy_match_exact() {
        let result = fuzzy_match("main", "main");
        assert!(result.is_some());
        let m = result.unwrap();
        assert_eq!(m.indices, vec![0, 1, 2, 3]);
    }

    #[test]
    fn test_fuzzy_match_empty_pattern() {
        let result = fuzzy_match("", "feature/auth");
        assert!(result.is_none());
    }

    #[test]
    fn test_fuzzy_match_case_insensitive() {
        // SkimMatcherV2はデフォルトでcase-insensitiveだが、
        // パターンが全て大文字の場合はcase-sensitiveになる場合がある
        // 小文字パターンでのマッチを検証
        let result = fuzzy_match("main", "MAIN");
        assert!(result.is_some());
    }

    #[test]
    fn test_fuzzy_match_word_boundary() {
        // 単語境界でのマッチはスコアが高くなる
        let result1 = fuzzy_match("auth", "feature/auth");
        let result2 = fuzzy_match("auth", "featureauth");

        assert!(result1.is_some());
        assert!(result2.is_some());

        // 単語境界マッチの方がスコアが高い
        assert!(result1.unwrap().score >= result2.unwrap().score);
    }

    #[test]
    fn test_fuzzy_match_continuous() {
        // 連続マッチはスコアが高くなる
        let result_continuous = fuzzy_match("feat", "feature/auth");
        let result_spread = fuzzy_match("fea", "feature/auth");

        assert!(result_continuous.is_some());
        assert!(result_spread.is_some());

        // 4文字連続マッチの方が3文字連続マッチよりスコアが高い
        assert!(result_continuous.unwrap().score > result_spread.unwrap().score);
    }

    #[test]
    fn test_fuzzy_match_multibyte() {
        // マルチバイト文字でも動作する
        let result = fuzzy_match("日本", "日本語テスト");
        assert!(result.is_some());
        let m = result.unwrap();
        assert_eq!(m.indices, vec![0, 1]);
    }
}
