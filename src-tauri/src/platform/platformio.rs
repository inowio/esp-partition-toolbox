use std::path::Path;

use crate::platform::{
    mcu_from_board, ConfigTarget, ConfigUpdateParams, ConfigUpdateResult, Platform, ProjectAdapter,
    ProjectContext,
};
use crate::platform::ini;
use crate::{generate_default_partition_csv, parse_flash_size_string, DEFAULT_PARTITION_OFFSET};

pub struct PlatformIoAdapter;

fn basename(path: &str) -> String {
    path.rsplit(['/', '\\']).next().unwrap_or(path).to_string()
}

fn split_list(value: &str) -> Vec<String> {
    value
        .split([',', ' ', '\t', '\n'])
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(str::to_string)
        .collect()
}

impl ProjectAdapter for PlatformIoAdapter {
    fn read_context(&self, project_dir: &Path, fallback_flash_mb: u32) -> Result<ProjectContext, String> {
        let ini_path = project_dir.join("platformio.ini");
        let content = std::fs::read_to_string(&ini_path)
            .map_err(|e| format!("Failed to read platformio.ini: {e}"))?;

        let envs = ini::env_names(&content);
        if envs.is_empty() {
            return Err("No [env:...] sections found in platformio.ini.".to_string());
        }

        let defaults = ini::get_in_section(&content, "platformio", "default_envs")
            .map(|v| split_list(&v))
            .unwrap_or_default();
        let primary = defaults
            .iter()
            .find(|e| envs.contains(e))
            .cloned()
            .unwrap_or_else(|| envs[0].clone());
        let header = format!("env:{primary}");

        // Read a key from the env section, falling back to the global [env].
        let read = |key: &str| {
            ini::get_in_section(&content, &header, key)
                .or_else(|| ini::get_in_section(&content, "env", key))
        };

        let board = read("board");
        let mcu = read("board_build.mcu")
            .or_else(|| board.as_deref().and_then(mcu_from_board));
        let flash_size_mb = read("board_upload.flash_size")
            .or_else(|| read("board_build.flash_size"))
            .and_then(|v| parse_flash_size_string(&v));

        let partitions_rel = read("board_build.partitions");
        let partition_filename = partitions_rel
            .as_deref()
            .map(basename)
            .unwrap_or_else(|| "partitions.csv".to_string());
        let partition_file_path = project_dir.join(partitions_rel.as_deref().unwrap_or("partitions.csv"));
        let partition_file_exists = partition_file_path.is_file();
        let partition_content = if partition_file_exists {
            std::fs::read_to_string(&partition_file_path)
                .map_err(|e| format!("Failed to read partition file: {e}"))?
        } else {
            generate_default_partition_csv(fallback_flash_mb, DEFAULT_PARTITION_OFFSET)
        };

        let config_targets = envs
            .iter()
            .map(|e| ConfigTarget { id: format!("env:{e}"), label: e.clone() })
            .collect();

        let mut warnings = Vec::new();
        if let Some(p) = &partitions_rel {
            if p.contains('/') || p.contains('\\') {
                warnings.push(format!(
                    "board_build.partitions points to '{p}'; saving writes the CSV to the project root as '{partition_filename}'."
                ));
            }
        }

        Ok(ProjectContext {
            platform: Platform::PlatformIo,
            confidence: "high".to_string(),
            markers: vec!["platformio.ini".to_string()],
            mcu,
            flash_size_mb,
            partition_filename,
            partition_file_path: partition_file_path.to_string_lossy().to_string(),
            partition_content,
            partition_file_exists,
            // PlatformIO/arduino-esp32 fix the table offset at 0x8000; not in ini.
            partition_offset: "0x8000".to_string(),
            config_targets,
            config_updatable: true,
            warnings,
        })
    }

    fn apply_config_update(&self, project_dir: &Path, params: &ConfigUpdateParams) -> Result<ConfigUpdateResult, String> {
        let ini_path = project_dir.join("platformio.ini");
        let content = std::fs::read_to_string(&ini_path)
            .map_err(|e| format!("Failed to read platformio.ini: {e}"))?;

        // selected_targets are "env:NAME" ids; default to every env if none chosen.
        let targets: Vec<String> = if params.selected_targets.is_empty() {
            ini::env_names(&content).into_iter().map(|e| format!("env:{e}")).collect()
        } else {
            params.selected_targets.to_vec()
        };

        let mut updated = content.clone();
        for target in &targets {
            updated = ini::upsert_in_section(&updated, target, "board_build.partitions", params.partition_filename);
        }

        let changed = updated != content;
        if changed {
            std::fs::write(&ini_path, &updated)
                .map_err(|e| format!("Failed to update platformio.ini: {e}"))?;
        }

        Ok(ConfigUpdateResult { config_updated: changed, warnings: Vec::new() })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp(label: &str) -> std::path::PathBuf {
        use std::sync::atomic::{AtomicU64, Ordering};
        static C: AtomicU64 = AtomicU64::new(0);
        let nanos = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_nanos();
        let seq = C.fetch_add(1, Ordering::Relaxed);
        let dir = std::env::temp_dir().join(format!("ept_pio_{label}_{nanos}_{seq}"));
        std::fs::create_dir_all(&dir).unwrap();
        dir
    }

    const INI: &str = "[platformio]\ndefault_envs = esp32s3\n\n[env:esp32s3]\nplatform = espressif32\nboard = esp32-s3-devkitc-1\nboard_upload.flash_size = 8MB\nboard_build.partitions = partitions.csv\n\n[env:esp32c3]\nplatform = espressif32\nboard = esp32-c3-devkitm-1\n";

    #[test]
    fn read_context_extracts_mcu_flash_targets_from_default_env() {
        let dir = temp("read");
        std::fs::write(dir.join("platformio.ini"), INI).unwrap();
        std::fs::write(dir.join("partitions.csv"), "nvs, data, nvs, 0x9000, 16K,\n").unwrap();

        let ctx = PlatformIoAdapter.read_context(&dir, 4).unwrap();
        assert_eq!(ctx.platform, Platform::PlatformIo);
        assert_eq!(ctx.mcu.as_deref(), Some("esp32s3"));
        assert_eq!(ctx.flash_size_mb, Some(8));
        assert_eq!(ctx.partition_filename, "partitions.csv");
        assert!(ctx.partition_content.contains("nvs, data, nvs"));
        assert_eq!(ctx.config_targets.iter().map(|t| t.id.clone()).collect::<Vec<_>>(),
                   vec!["env:esp32s3".to_string(), "env:esp32c3".to_string()]);
        assert!(ctx.config_updatable);
        std::fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn read_context_generates_default_csv_when_missing() {
        let dir = temp("read_default");
        std::fs::write(dir.join("platformio.ini"), INI).unwrap();
        let ctx = PlatformIoAdapter.read_context(&dir, 4).unwrap();
        assert!(!ctx.partition_file_exists);
        assert!(ctx.partition_content.contains("factory, app, factory"));
        std::fs::remove_dir_all(&dir).ok();
    }

    use crate::platform::ConfigUpdateParams;

    #[test]
    fn apply_config_update_upserts_partitions_in_selected_env() {
        let dir = temp("apply_one");
        std::fs::write(dir.join("platformio.ini"), INI).unwrap();

        let params = ConfigUpdateParams {
            partition_filename: "custom.csv",
            partition_offset: 0x8000,
            selected_targets: &["env:esp32s3".to_string()],
        };
        let result = PlatformIoAdapter.apply_config_update(&dir, &params).unwrap();
        assert!(result.config_updated);

        let written = std::fs::read_to_string(dir.join("platformio.ini")).unwrap();
        assert!(written.contains("board_build.partitions = custom.csv"));
        // esp32c3 untouched (no partitions key added)
        assert_eq!(crate::platform::ini::get_in_section(&written, "env:esp32c3", "board_build.partitions"), None);
        std::fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn apply_config_update_is_idempotent_no_duplicates() {
        let dir = temp("apply_idem");
        std::fs::write(dir.join("platformio.ini"), INI).unwrap();
        let params = ConfigUpdateParams {
            partition_filename: "custom.csv",
            partition_offset: 0x8000,
            selected_targets: &["env:esp32s3".to_string()],
        };
        PlatformIoAdapter.apply_config_update(&dir, &params).unwrap();
        let once = std::fs::read_to_string(dir.join("platformio.ini")).unwrap();
        let second = PlatformIoAdapter.apply_config_update(&dir, &params).unwrap();
        let twice = std::fs::read_to_string(dir.join("platformio.ini")).unwrap();
        assert_eq!(once, twice);
        assert!(!second.config_updated); // nothing changed the second time
        assert_eq!(once.matches("board_build.partitions").count(), 1);
        std::fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn apply_config_update_writes_all_envs_when_none_selected() {
        let dir = temp("apply_all");
        std::fs::write(dir.join("platformio.ini"), INI).unwrap();
        let params = ConfigUpdateParams {
            partition_filename: "custom.csv",
            partition_offset: 0x8000,
            selected_targets: &[],
        };
        PlatformIoAdapter.apply_config_update(&dir, &params).unwrap();
        let written = std::fs::read_to_string(dir.join("platformio.ini")).unwrap();
        assert_eq!(crate::platform::ini::get_in_section(&written, "env:esp32s3", "board_build.partitions").as_deref(), Some("custom.csv"));
        assert_eq!(crate::platform::ini::get_in_section(&written, "env:esp32c3", "board_build.partitions").as_deref(), Some("custom.csv"));
        std::fs::remove_dir_all(&dir).ok();
    }
}
