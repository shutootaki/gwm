//! Hash computation for configuration files.
//!
//! Uses SHA-256 to compute file hashes for trust verification.
//! Implements streaming hash computation to avoid loading entire files into memory.

use sha2::{Digest, Sha256};
use std::fs::{self, File};
use std::io::{BufReader, Read};
use std::path::Path;

use crate::error::{GwmError, Result};

/// Buffer size for streaming hash computation (8KB).
const HASH_BUFFER_SIZE: usize = 8192;

/// Maximum allowed config file size (10MB).
/// Files larger than this are rejected to prevent potential DoS attacks.
const MAX_CONFIG_SIZE: u64 = 10 * 1024 * 1024;

/// Compute SHA-256 hash of a file using streaming to avoid OOM.
///
/// Returns the hash as a lowercase hex string.
///
/// # Errors
/// - Returns `GwmError::Config` if the file exceeds `MAX_CONFIG_SIZE`
/// - Returns `GwmError::Io` if the file cannot be read
pub fn compute_file_hash(path: &Path) -> Result<String> {
    // Check file size first
    let metadata = fs::metadata(path)?;
    if metadata.len() > MAX_CONFIG_SIZE {
        return Err(GwmError::config(format!(
            "Config file too large: {} bytes (max: {} bytes)",
            metadata.len(),
            MAX_CONFIG_SIZE
        )));
    }

    // Use streaming hash computation
    let file = File::open(path)?;
    let mut reader = BufReader::new(file);
    let mut hasher = Sha256::new();
    let mut buffer = [0u8; HASH_BUFFER_SIZE];

    loop {
        let bytes_read = reader.read(&mut buffer)?;
        if bytes_read == 0 {
            break;
        }
        hasher.update(&buffer[..bytes_read]);
    }

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
        let mut file = NamedTempFile::new().expect("Failed to create temp file");
        writeln!(file, "test content").expect("Failed to write to temp file");

        let hash = compute_file_hash(file.path()).expect("Hash computation should succeed");

        // Hash should be 64 characters (256 bits = 32 bytes = 64 hex chars)
        assert_eq!(hash.len(), 64);

        // Hash should be consistent
        let hash2 = compute_file_hash(file.path()).expect("Hash computation should succeed");
        assert_eq!(hash, hash2);
    }

    #[test]
    fn test_different_content_different_hash() {
        let mut file1 = NamedTempFile::new().expect("Failed to create temp file");
        let mut file2 = NamedTempFile::new().expect("Failed to create temp file");

        writeln!(file1, "content 1").expect("Failed to write to temp file");
        writeln!(file2, "content 2").expect("Failed to write to temp file");

        let hash1 = compute_file_hash(file1.path()).expect("Hash computation should succeed");
        let hash2 = compute_file_hash(file2.path()).expect("Hash computation should succeed");

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
        let mut file1 = NamedTempFile::new().expect("Failed to create temp file");
        let mut file2 = NamedTempFile::new().expect("Failed to create temp file");

        let content = "identical content\nwith multiple lines";
        file1
            .write_all(content.as_bytes())
            .expect("Failed to write to temp file");
        file2
            .write_all(content.as_bytes())
            .expect("Failed to write to temp file");

        let hash1 = compute_file_hash(file1.path()).expect("Hash computation should succeed");
        let hash2 = compute_file_hash(file2.path()).expect("Hash computation should succeed");

        assert_eq!(hash1, hash2);
    }

    #[test]
    fn test_compute_file_hash_empty_file() {
        // 空ファイルのハッシュ
        let file = NamedTempFile::new().expect("Failed to create temp file");
        // 何も書き込まない

        let hash = compute_file_hash(file.path()).expect("Hash computation should succeed");

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
        let mut file = NamedTempFile::new().expect("Failed to create temp file");
        writeln!(file, "test").expect("Failed to write to temp file");

        let hash = compute_file_hash(file.path()).expect("Hash computation should succeed");

        for c in hash.chars() {
            assert!(
                c.is_ascii_digit() || ('a'..='f').contains(&c),
                "Hash should be lowercase hex, got: {}",
                c
            );
        }
    }

    #[test]
    fn test_streaming_hash_matches_direct_hash() {
        // ストリーミング処理でも直接計算と同じ結果になることを確認
        let mut file = NamedTempFile::new().expect("Failed to create temp file");
        let content = "test content for streaming verification\n".repeat(100);
        file.write_all(content.as_bytes())
            .expect("Failed to write to temp file");

        let hash = compute_file_hash(file.path()).expect("Hash computation should succeed");

        // 直接計算
        let mut hasher = Sha256::new();
        hasher.update(content.as_bytes());
        let expected = format!("{:x}", hasher.finalize());

        assert_eq!(hash, expected);
    }
}
