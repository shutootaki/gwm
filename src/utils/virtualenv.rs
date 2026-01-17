//! 仮想環境の検出と隔離機能
//!
//! Python venv、Node.js node_modulesなどの仮想環境を検出し、
//! 新しいworktree作成時に適切な処理を行います。

use std::fs;
use std::path::{Path, PathBuf};

use crate::config::VirtualEnvConfig;
use crate::error::Result;

/// シンボリックリンクを作成（Unix系）
#[cfg(unix)]
fn create_symlink(target: &Path, link: &Path) -> Result<()> {
    use std::os::unix::fs as unix_fs;
    unix_fs::symlink(target, link)?;
    Ok(())
}

/// シンボリックリンクを作成（Windows: 警告を出してスキップ）
#[cfg(windows)]
fn create_symlink(target: &Path, link: &Path) -> Result<()> {
    // Windowsではシンボリックリンクに管理者権限が必要な場合があるため、
    // 警告を出してスキップする
    eprintln!(
        "Warning: Symlink creation skipped on Windows: {} -> {}",
        link.display(),
        target.display()
    );
    Ok(())
}

/// 仮想環境の検出結果
#[derive(Debug, Clone)]
pub struct VirtualEnvDetection {
    /// 検出されたパス
    pub path: PathBuf,
    /// 仮想環境の種類
    pub env_type: VirtualEnvType,
}

/// 仮想環境の種類
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum VirtualEnvType {
    /// Python仮想環境（venv, .venv, etc.）
    PythonVenv,
    /// Node.js node_modules
    NodeModules,
    /// カスタム定義された仮想環境
    Custom,
}

impl VirtualEnvType {
    /// 仮想環境の種類を文字列として取得
    pub fn as_str(&self) -> &'static str {
        match self {
            VirtualEnvType::PythonVenv => "Python venv",
            VirtualEnvType::NodeModules => "Node.js node_modules",
            VirtualEnvType::Custom => "Custom",
        }
    }

    /// 絵文字アイコンを取得
    pub fn icon(&self) -> &'static str {
        match self {
            VirtualEnvType::PythonVenv => "🐍",
            VirtualEnvType::NodeModules => "📦",
            VirtualEnvType::Custom => "⚙️",
        }
    }
}

/// デフォルトのPython仮想環境パターン
const PYTHON_VENV_PATTERNS: &[&str] = &["venv", ".venv", "env", ".env"];

/// デフォルトのNode.jsパターン
const NODE_PATTERNS: &[&str] = &["node_modules"];

/// 仮想環境を検出
///
/// # Arguments
/// * `worktree_path` - 検索対象のworktreeパス
/// * `config` - 仮想環境設定（Noneの場合はデフォルト設定を使用）
///
/// # Returns
/// 検出された仮想環境のリスト
pub fn detect_virtual_envs(
    worktree_path: &Path,
    config: Option<&VirtualEnvConfig>,
) -> Result<Vec<VirtualEnvDetection>> {
    let mut detections = Vec::new();
    let default_config = VirtualEnvConfig::default();
    let config = config.unwrap_or(&default_config);

    // Python仮想環境を検出
    for pattern in PYTHON_VENV_PATTERNS {
        let path = worktree_path.join(pattern);
        if path.exists() && path.is_dir() {
            // pyvenv.cfg の存在で確認（Python venvの特徴）
            if path.join("pyvenv.cfg").exists() {
                detections.push(VirtualEnvDetection {
                    path,
                    env_type: VirtualEnvType::PythonVenv,
                });
            }
        }
    }

    // Node.js node_modulesを検出
    for pattern in NODE_PATTERNS {
        let path = worktree_path.join(pattern);
        if path.exists() && path.is_dir() {
            detections.push(VirtualEnvDetection {
                path,
                env_type: VirtualEnvType::NodeModules,
            });
        }
    }

    // カスタムパターンを検出
    for custom in &config.custom_patterns {
        for pattern in &custom.patterns {
            let path = worktree_path.join(pattern);
            if path.exists() && path.is_dir() {
                detections.push(VirtualEnvDetection {
                    path,
                    env_type: VirtualEnvType::Custom,
                });
            }
        }
    }

    Ok(detections)
}

/// パスが仮想環境としてスキップすべきかどうかを判定
///
/// # Arguments
/// * `path` - チェック対象のパス
/// * `config` - 仮想環境設定
pub fn should_skip_virtualenv(path: &Path, config: &VirtualEnvConfig) -> bool {
    if !config.should_isolate() {
        return false;
    }

    let file_name = path.file_name().and_then(|n| n.to_str()).unwrap_or("");

    // Python仮想環境
    if PYTHON_VENV_PATTERNS.contains(&file_name) {
        return true;
    }

    // Node.js
    if NODE_PATTERNS.contains(&file_name) {
        return true;
    }

    // カスタムパターン
    for custom in &config.custom_patterns {
        if custom.patterns.contains(&file_name.to_string()) {
            return true;
        }
    }

    false
}

/// Python仮想環境を新規worktree用に隔離
///
/// 仮想環境全体をコピーし、シンボリックリンクを書き換えて
/// 新しいworktreeのパスを指すようにする
///
/// # Arguments
/// * `source_venv` - コピー元の仮想環境パス
/// * `target_venv` - コピー先の仮想環境パス
/// * `_config` - 仮想環境設定（将来の拡張用: カスタム設定によるコピー動作の制御など）
#[allow(dead_code)] // 将来の機能拡張用に保持
pub fn isolate_python_venv(
    source_venv: &Path,
    target_venv: &Path,
    _config: &VirtualEnvConfig,
) -> Result<()> {
    // 仮想環境全体をコピー
    copy_dir_recursive(source_venv, target_venv)?;

    // bin ディレクトリ内のシンボリックリンクを更新（Unix系のみ）
    let bin_dir = target_venv.join("bin");
    if bin_dir.exists() {
        update_symlinks_in_dir(&bin_dir, source_venv, target_venv)?;
    }

    // pyvenv.cfg を更新
    let cfg_path = target_venv.join("pyvenv.cfg");
    if cfg_path.exists() {
        update_pyvenv_cfg(&cfg_path, source_venv, target_venv)?;
    }

    Ok(())
}

/// ディレクトリを再帰的にコピー
///
/// # Safety
///
/// シンボリックリンクは再帰せず、リンク自体をコピーします。
/// これにより無限ループや意図しないディレクトリへのアクセスを防ぎます。
fn copy_dir_recursive(src: &Path, dst: &Path) -> Result<()> {
    fs::create_dir_all(dst)?;

    for entry in fs::read_dir(src)? {
        let entry = entry?;
        // Use file_type() which doesn't follow symlinks, unlike is_dir()/is_file()
        let file_type = entry.file_type()?;
        let src_path = entry.path();
        let dst_path = dst.join(entry.file_name());

        // Check symlink FIRST to avoid following symlinks to directories
        if file_type.is_symlink() {
            // シンボリックリンクをコピー (do not follow)
            let target = fs::read_link(&src_path)?;
            create_symlink(&target, &dst_path)?;
            continue;
        }

        if file_type.is_dir() {
            copy_dir_recursive(&src_path, &dst_path)?;
            continue;
        }

        // Regular file
        fs::copy(&src_path, &dst_path)?;
    }

    Ok(())
}

/// ディレクトリ内のシンボリックリンクを更新
fn update_symlinks_in_dir(dir: &Path, old_base: &Path, new_base: &Path) -> Result<()> {
    for entry in fs::read_dir(dir)? {
        let entry = entry?;
        let path = entry.path();

        if path.is_symlink() {
            let target = fs::read_link(&path)?;
            let target_str = target.display().to_string();
            let old_base_str = old_base.display().to_string();

            // 古いベースパスを含む場合は更新
            if target_str.contains(&old_base_str) {
                let new_target_str =
                    target_str.replace(&old_base_str, &new_base.display().to_string());
                let new_target = PathBuf::from(new_target_str);

                fs::remove_file(&path)?;
                create_symlink(&new_target, &path)?;
            }
        }
    }

    Ok(())
}

/// pyvenv.cfg を更新（将来の拡張用）
///
/// 現在の実装では、pyvenv.cfgの`home`設定はPythonインタプリタのパスを指しており、
/// worktree間で変更する必要がないため、改行コードの正規化のみ行っています。
///
/// 将来的に以下の拡張が想定されます:
/// - `prompt`設定の更新（worktree名を反映）
/// - カスタム設定の注入
///
/// # Arguments
/// * `cfg_path` - pyvenv.cfgファイルのパス
/// * `_old_base` - 元のworktreeパス（将来の拡張用）
/// * `_new_base` - 新しいworktreeパス（将来の拡張用）
fn update_pyvenv_cfg(cfg_path: &Path, _old_base: &Path, _new_base: &Path) -> Result<()> {
    let content = fs::read_to_string(cfg_path)?;
    // 改行コードをLFに正規化（Windows/Unix間の互換性のため）
    let normalized_content = content.lines().collect::<Vec<_>>().join("\n");
    fs::write(cfg_path, normalized_content)?;

    Ok(())
}

/// 仮想環境セットアップの提案を生成
///
/// 検出された仮想環境に対して、ユーザーが実行すべきセットアップコマンドを提案
pub fn suggest_virtualenv_setup(detections: &[VirtualEnvDetection]) -> Vec<String> {
    let mut suggestions = Vec::new();

    for detection in detections {
        match detection.env_type {
            VirtualEnvType::PythonVenv => {
                let venv_name = detection
                    .path
                    .file_name()
                    .unwrap_or_default()
                    .to_string_lossy();
                suggestions.push(format!(
                    "{} Python venv detected at '{}'. Run: python -m venv {} && pip install -r requirements.txt",
                    detection.env_type.icon(),
                    detection.path.display(),
                    venv_name
                ));
            }
            VirtualEnvType::NodeModules => {
                suggestions.push(format!(
                    "{} Node.js project detected. Run: npm install (or yarn/pnpm install)",
                    detection.env_type.icon()
                ));
            }
            VirtualEnvType::Custom => {
                suggestions.push(format!(
                    "{} Custom environment detected at '{}'",
                    detection.env_type.icon(),
                    detection.path.display()
                ));
            }
        }
    }

    suggestions
}

/// 仮想環境検出の結果を表示
pub fn print_virtualenv_suggestions(detections: &[VirtualEnvDetection]) {
    if detections.is_empty() {
        return;
    }

    println!("\n📦 Virtual environments detected:");
    for suggestion in suggest_virtualenv_setup(detections) {
        println!("  • {}", suggestion);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::TempDir;

    #[test]
    fn test_detect_python_venv() {
        let temp_dir = TempDir::new().unwrap();
        let venv_path = temp_dir.path().join(".venv");
        fs::create_dir(&venv_path).unwrap();
        fs::write(venv_path.join("pyvenv.cfg"), "home = /usr/bin/python3").unwrap();

        let detections = detect_virtual_envs(temp_dir.path(), None).unwrap();
        assert_eq!(detections.len(), 1);
        assert_eq!(detections[0].env_type, VirtualEnvType::PythonVenv);
    }

    #[test]
    fn test_detect_node_modules() {
        let temp_dir = TempDir::new().unwrap();
        let node_path = temp_dir.path().join("node_modules");
        fs::create_dir(node_path).unwrap();

        let detections = detect_virtual_envs(temp_dir.path(), None).unwrap();
        assert_eq!(detections.len(), 1);
        assert_eq!(detections[0].env_type, VirtualEnvType::NodeModules);
    }

    #[test]
    fn test_detect_multiple() {
        let temp_dir = TempDir::new().unwrap();

        // Python venv
        let venv_path = temp_dir.path().join("venv");
        fs::create_dir(&venv_path).unwrap();
        fs::write(venv_path.join("pyvenv.cfg"), "home = /usr/bin/python3").unwrap();

        // Node.js
        let node_path = temp_dir.path().join("node_modules");
        fs::create_dir(node_path).unwrap();

        let detections = detect_virtual_envs(temp_dir.path(), None).unwrap();
        assert_eq!(detections.len(), 2);
    }

    #[test]
    fn test_detect_no_venv() {
        let temp_dir = TempDir::new().unwrap();

        // .venv ディレクトリはあるが pyvenv.cfg がない
        let venv_path = temp_dir.path().join(".venv");
        fs::create_dir(venv_path).unwrap();

        let detections = detect_virtual_envs(temp_dir.path(), None).unwrap();
        assert_eq!(detections.len(), 0);
    }

    #[test]
    fn test_should_skip_virtualenv() {
        let config = VirtualEnvConfig {
            isolate_virtual_envs: Some(true),
            ..Default::default()
        };

        assert!(should_skip_virtualenv(Path::new("/path/to/venv"), &config));
        assert!(should_skip_virtualenv(Path::new("/path/to/.venv"), &config));
        assert!(should_skip_virtualenv(
            Path::new("/path/to/node_modules"),
            &config
        ));
        assert!(!should_skip_virtualenv(Path::new("/path/to/src"), &config));
    }

    #[test]
    fn test_should_not_skip_when_disabled() {
        let config = VirtualEnvConfig {
            isolate_virtual_envs: Some(false),
            ..Default::default()
        };

        assert!(!should_skip_virtualenv(Path::new("/path/to/venv"), &config));
        assert!(!should_skip_virtualenv(
            Path::new("/path/to/node_modules"),
            &config
        ));
    }

    #[test]
    fn test_virtualenv_type_as_str() {
        assert_eq!(VirtualEnvType::PythonVenv.as_str(), "Python venv");
        assert_eq!(VirtualEnvType::NodeModules.as_str(), "Node.js node_modules");
        assert_eq!(VirtualEnvType::Custom.as_str(), "Custom");
    }

    #[test]
    fn test_suggest_virtualenv_setup() {
        let detections = vec![
            VirtualEnvDetection {
                path: PathBuf::from("/project/.venv"),
                env_type: VirtualEnvType::PythonVenv,
            },
            VirtualEnvDetection {
                path: PathBuf::from("/project/node_modules"),
                env_type: VirtualEnvType::NodeModules,
            },
        ];

        let suggestions = suggest_virtualenv_setup(&detections);
        assert_eq!(suggestions.len(), 2);
        assert!(suggestions[0].contains("Python"));
        assert!(suggestions[1].contains("Node.js"));
    }
}
