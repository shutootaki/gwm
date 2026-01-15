//! Hash computation for configuration files.
//!
//! Uses SHA-256 to compute file hashes for trust verification.

use sha2::{Digest, Sha256};
use std::fs;
use std::path::Path;

use crate::error::Result;

/// Compute SHA-256 hash of a file.
///
/// Returns the hash as a lowercase hex string.
pub fn compute_file_hash(path: &Path) -> Result<String> {
    let content = fs::read_to_string(path)?;
    let mut hasher = Sha256::new();
    hasher.update(content.as_bytes());
    let result = hasher.finalize();
    Ok(format!("{:x}", result))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;
    use tempfile::NamedTempFile;

    #[test]
    fn test_compute_file_hash() {
        let mut file = NamedTempFile::new().unwrap();
        writeln!(file, "test content").unwrap();

        let hash = compute_file_hash(file.path()).unwrap();

        // Hash should be 64 characters (256 bits = 32 bytes = 64 hex chars)
        assert_eq!(hash.len(), 64);

        // Hash should be consistent
        let hash2 = compute_file_hash(file.path()).unwrap();
        assert_eq!(hash, hash2);
    }

    #[test]
    fn test_different_content_different_hash() {
        let mut file1 = NamedTempFile::new().unwrap();
        let mut file2 = NamedTempFile::new().unwrap();

        writeln!(file1, "content 1").unwrap();
        writeln!(file2, "content 2").unwrap();

        let hash1 = compute_file_hash(file1.path()).unwrap();
        let hash2 = compute_file_hash(file2.path()).unwrap();

        assert_ne!(hash1, hash2);
    }

    #[test]
    fn test_nonexistent_file() {
        let result = compute_file_hash(Path::new("/nonexistent/file.txt"));
        assert!(result.is_err());
    }

    #[test]
    fn test_compute_file_hash_same_content() {
        // 同一内容で同一ハッシュになることを確認
        let mut file1 = NamedTempFile::new().unwrap();
        let mut file2 = NamedTempFile::new().unwrap();

        let content = "identical content\nwith multiple lines";
        file1.write_all(content.as_bytes()).unwrap();
        file2.write_all(content.as_bytes()).unwrap();

        let hash1 = compute_file_hash(file1.path()).unwrap();
        let hash2 = compute_file_hash(file2.path()).unwrap();

        assert_eq!(hash1, hash2);
    }

    #[test]
    fn test_compute_file_hash_empty_file() {
        // 空ファイルのハッシュ
        let file = NamedTempFile::new().unwrap();
        // 何も書き込まない

        let hash = compute_file_hash(file.path()).unwrap();

        // 空ファイルでも有効な64文字のハッシュになる
        assert_eq!(hash.len(), 64);

        // SHA-256 of empty string is known
        // e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
        assert_eq!(
            hash,
            "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
        );
    }

    #[test]
    fn test_compute_file_hash_lowercase_hex() {
        // ハッシュが小文字の16進数であることを確認
        let mut file = NamedTempFile::new().unwrap();
        writeln!(file, "test").unwrap();

        let hash = compute_file_hash(file.path()).unwrap();

        for c in hash.chars() {
            assert!(
                c.is_ascii_digit() || ('a'..='f').contains(&c),
                "Hash should be lowercase hex, got: {}",
                c
            );
        }
    }
}
