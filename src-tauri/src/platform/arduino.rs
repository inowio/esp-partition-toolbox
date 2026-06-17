//! Arduino adapter. The arduino-esp32 build reads a sketch-folder `partitions.csv`
//! when the FQBN partition scheme is `custom`. We always write that CSV (done by
//! the save_project command) and, only when a `sketch.yaml` already exists, set
//! `PartitionScheme=custom` on every FQBN. We never create `sketch.yaml`.
//!
//! Line-oriented (no YAML crate); FlashSize is read but never written (spec D3).

use std::path::{Path, PathBuf};

use crate::platform::{
    mcu_from_board, ConfigTarget, ConfigUpdateParams, ConfigUpdateResult, Platform, ProjectAdapter,
    ProjectContext,
};
use crate::{generate_default_partition_csv, parse_flash_size_string};

pub struct ArduinoAdapter;

const SKETCH_YAML_NAMES: [&str; 2] = ["sketch.yaml", "sketch.yml"];

/// Path to an existing sketch.yaml / sketch.yml, if present.
fn find_sketch_yaml(project_dir: &Path) -> Option<PathBuf> {
    SKETCH_YAML_NAMES
        .iter()
        .map(|name| project_dir.join(name))
        .find(|path| path.is_file())
}

/// Strip a single pair of matching surrounding quotes; returns (value, quote_char).
fn unquote(s: &str) -> (&str, Option<char>) {
    let first = s.chars().next();
    if let Some(q) = first {
        if (q == '"' || q == '\'') && s.len() >= 2 && s.ends_with(q) {
            return (&s[1..s.len() - 1], Some(q));
        }
    }
    (s, None)
}

/// `rest` is the text after a `default_fqbn`/`fqbn` key. Require a `:` follows,
/// then return the unquoted value (None if empty / not a key line).
fn fqbn_value(rest: &str) -> Option<String> {
    let after = rest.trim_start().strip_prefix(':')?;
    let value = after.trim();
    if value.is_empty() {
        return None;
    }
    Some(unquote(value).0.to_string())
}

/// First FQBN in a sketch.yaml: prefer `default_fqbn`, else the first profile `fqbn`.
fn first_fqbn(yaml: &str) -> Option<String> {
    let mut profile_fqbn: Option<String> = None;
    for line in yaml.lines() {
        let trimmed = line.trim_start();
        if let Some(rest) = trimmed.strip_prefix("default_fqbn") {
            if let Some(value) = fqbn_value(rest) {
                return Some(value);
            }
        } else if let Some(rest) = trimmed.strip_prefix("fqbn") {
            if profile_fqbn.is_none() {
                profile_fqbn = fqbn_value(rest);
            }
        }
    }
    profile_fqbn
}

/// (mcu, flash_mb) from an FQBN like `esp32:esp32:esp32s3:PartitionScheme=custom,FlashSize=8M`.
fn parse_fqbn(fqbn: &str) -> (Option<String>, Option<u32>) {
    let parts: Vec<&str> = fqbn.splitn(4, ':').collect();
    let mcu = parts.get(2).and_then(|board| mcu_from_board(board));
    let flash = parts.get(3).and_then(|opts| {
        opts.split(',')
            .filter_map(|kv| kv.split_once('='))
            .find(|(k, _)| k.trim().eq_ignore_ascii_case("FlashSize"))
            .and_then(|(_, v)| parse_flash_size_string(v.trim()))
    });
    (mcu, flash)
}

/// Force `PartitionScheme=custom` on a board FQBN, preserving the base triple and
/// all other menu options. Leaves non-board strings (< 3 colon segments) untouched.
/// Idempotent.
fn set_partition_scheme_custom(fqbn: &str) -> String {
    let parts: Vec<&str> = fqbn.splitn(4, ':').collect();
    if parts.len() < 3 {
        return fqbn.to_string();
    }
    let base = parts[..3].join(":");

    let mut opts: Vec<(String, String)> = Vec::new();
    if let Some(opt_str) = parts.get(3) {
        for kv in opt_str.split(',') {
            let kv = kv.trim();
            if kv.is_empty() {
                continue;
            }
            match kv.split_once('=') {
                Some((k, v)) => opts.push((k.trim().to_string(), v.trim().to_string())),
                None => opts.push((kv.to_string(), String::new())),
            }
        }
    }

    let mut found = false;
    for (k, v) in opts.iter_mut() {
        if k.eq_ignore_ascii_case("PartitionScheme") {
            *v = "custom".to_string();
            found = true;
        }
    }
    if !found {
        opts.push(("PartitionScheme".to_string(), "custom".to_string()));
    }

    let rendered = opts
        .iter()
        .map(|(k, v)| if v.is_empty() { k.clone() } else { format!("{k}={v}") })
        .collect::<Vec<_>>()
        .join(",");
    format!("{base}:{rendered}")
}

/// Set `PartitionScheme=custom` on every `default_fqbn`/`fqbn` line, preserving
/// indentation, quoting, and the rest of the YAML. Returns (new_content, changed).
/// Idempotent.
fn update_sketch_yaml(content: &str) -> (String, bool) {
    let mut changed = false;
    let mut out: Vec<String> = Vec::new();

    for line in content.lines() {
        let indent_len = line.len() - line.trim_start().len();
        let (indent, trimmed) = line.split_at(indent_len);

        let mut rewritten: Option<String> = None;
        for key in ["default_fqbn", "fqbn"] {
            if let Some(rest) = trimmed.strip_prefix(key) {
                if let Some(after) = rest.trim_start().strip_prefix(':') {
                    let raw = after.trim();
                    if raw.is_empty() {
                        break;
                    }
                    let (value, quote) = unquote(raw);
                    let new_value = set_partition_scheme_custom(value);
                    let new_raw = match quote {
                        Some(q) => format!("{q}{new_value}{q}"),
                        None => new_value,
                    };
                    rewritten = Some(format!("{indent}{key}: {new_raw}"));
                    break;
                }
            }
        }

        match rewritten {
            Some(new_line) => {
                if new_line != line {
                    changed = true;
                }
                out.push(new_line);
            }
            None => out.push(line.to_string()),
        }
    }

    // Normalizes CRLF→LF on edit, matching the ini/sdkconfig writers (`lines()`
    // strips `\r`); only files we actually change are rewritten.
    let mut joined = out.join("\n");
    if content.ends_with('\n') && !joined.ends_with('\n') {
        joined.push('\n');
    }
    (joined, changed)
}

impl ProjectAdapter for ArduinoAdapter {
    fn read_context(&self, project_dir: &Path, fallback_flash_mb: u32) -> Result<ProjectContext, String> {
        let yaml_path = find_sketch_yaml(project_dir);
        let yaml = match &yaml_path {
            Some(path) => Some(
                std::fs::read_to_string(path)
                    .map_err(|e| format!("Failed to read {}: {e}", path.display()))?,
            ),
            None => None,
        };

        let fqbn = yaml.as_deref().and_then(first_fqbn);
        let (mcu, flash_size_mb) = match &fqbn {
            Some(f) => parse_fqbn(f),
            None => (None, None),
        };

        // arduino-esp32 reads `partitions.csv` from the sketch folder.
        let partition_file_path = project_dir.join("partitions.csv");
        let partition_file_exists = partition_file_path.is_file();
        let partition_content = if partition_file_exists {
            std::fs::read_to_string(&partition_file_path)
                .map_err(|e| format!("Failed to read partition file: {e}"))?
        } else {
            generate_default_partition_csv(flash_size_mb.unwrap_or(fallback_flash_mb))
        };

        let has_yaml = yaml_path.is_some();
        let config_targets = match &yaml_path {
            // Use the actual file name so a `sketch.yml` project isn't mislabeled.
            Some(path) => {
                let name = path
                    .file_name()
                    .map(|n| n.to_string_lossy().to_string())
                    .unwrap_or_else(|| "sketch.yaml".to_string());
                vec![ConfigTarget { id: name.clone(), label: name }]
            }
            None => Vec::new(),
        };

        let mut warnings = Vec::new();
        if !has_yaml {
            warnings.push(
                "No sketch.yaml found — chip and flash size can't be auto-detected; set them manually."
                    .to_string(),
            );
        }
        warnings.push(
            "Arduino: set Tools → Partition Scheme → \"Custom\" and do a clean rebuild so partitions.csv is used."
                .to_string(),
        );

        Ok(ProjectContext {
            platform: Platform::Arduino,
            confidence: "high".to_string(),
            markers: vec!["Arduino sketch".to_string()],
            mcu,
            flash_size_mb,
            partition_filename: "partitions.csv".to_string(),
            partition_file_path: partition_file_path.to_string_lossy().to_string(),
            partition_content,
            partition_file_exists,
            // arduino-esp32 fixes the partition-table offset at 0x8000; not written.
            partition_offset: "0x8000".to_string(),
            config_targets,
            config_updatable: has_yaml,
            warnings,
        })
    }

    fn apply_config_update(
        &self,
        project_dir: &Path,
        _params: &ConfigUpdateParams,
    ) -> Result<ConfigUpdateResult, String> {
        // Arduino's only committable config is sketch.yaml, and only if it exists
        // (never create it). The partition CSV itself is written by the command.
        let yaml_path = match find_sketch_yaml(project_dir) {
            Some(path) => path,
            None => {
                return Ok(ConfigUpdateResult {
                    config_updated: false,
                    warnings: vec![
                        "No sketch.yaml to update — set Tools → Partition Scheme → \"Custom\" in the Arduino IDE."
                            .to_string(),
                    ],
                });
            }
        };

        let content = std::fs::read_to_string(&yaml_path)
            .map_err(|e| format!("Failed to read sketch.yaml: {e}"))?;
        let (updated, changed) = update_sketch_yaml(&content);
        if changed {
            std::fs::write(&yaml_path, &updated)
                .map_err(|e| format!("Failed to update sketch.yaml: {e}"))?;
        }

        Ok(ConfigUpdateResult {
            config_updated: changed,
            warnings: Vec::new(),
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const YAML_DEFAULT: &str = "default_fqbn: esp32:esp32:esp32s3:PartitionScheme=huge_app,FlashSize=8M\nprofiles:\n  release:\n    fqbn: esp32:esp32:esp32c3\n";
    const YAML_PROFILE_ONLY: &str = "profiles:\n  debug:\n    fqbn: esp32:esp32:esp32:FlashSize=4M\n    platforms:\n      - platform: esp32:esp32 (3.0.0)\n";

    fn temp(label: &str) -> std::path::PathBuf {
        use std::sync::atomic::{AtomicU64, Ordering};
        static C: AtomicU64 = AtomicU64::new(0);
        let nanos = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_nanos();
        let seq = C.fetch_add(1, Ordering::Relaxed);
        let dir = std::env::temp_dir().join(format!("ept_ard_{label}_{nanos}_{seq}"));
        std::fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn first_fqbn_prefers_default_then_profile() {
        assert_eq!(
            first_fqbn(YAML_DEFAULT).as_deref(),
            Some("esp32:esp32:esp32s3:PartitionScheme=huge_app,FlashSize=8M")
        );
        assert_eq!(
            first_fqbn(YAML_PROFILE_ONLY).as_deref(),
            Some("esp32:esp32:esp32:FlashSize=4M")
        );
        assert_eq!(first_fqbn("name: blink\n"), None);
    }

    #[test]
    fn first_fqbn_handles_quoted_values() {
        assert_eq!(
            first_fqbn("default_fqbn: \"esp32:esp32:esp32s3\"\n").as_deref(),
            Some("esp32:esp32:esp32s3")
        );
    }

    #[test]
    fn first_fqbn_ignores_non_key_prefix_lines() {
        assert_eq!(first_fqbn("my_fqbn: nope\n"), None);
    }

    #[test]
    fn parse_fqbn_extracts_mcu_and_flash() {
        let (mcu, flash) = parse_fqbn("esp32:esp32:esp32s3:PartitionScheme=custom,FlashSize=8M");
        assert_eq!(mcu.as_deref(), Some("esp32s3"));
        assert_eq!(flash, Some(8));
    }

    #[test]
    fn parse_fqbn_without_options_has_no_flash() {
        let (mcu, flash) = parse_fqbn("esp32:esp32:esp32");
        assert_eq!(mcu.as_deref(), Some("esp32"));
        assert_eq!(flash, None);
    }

    #[test]
    fn set_scheme_replaces_existing_and_appends_when_absent() {
        assert_eq!(
            set_partition_scheme_custom("esp32:esp32:esp32s3:PartitionScheme=huge_app,FlashSize=8M"),
            "esp32:esp32:esp32s3:PartitionScheme=custom,FlashSize=8M"
        );
        assert_eq!(
            set_partition_scheme_custom("esp32:esp32:esp32s3:FlashSize=8M"),
            "esp32:esp32:esp32s3:FlashSize=8M,PartitionScheme=custom"
        );
        assert_eq!(
            set_partition_scheme_custom("esp32:esp32:esp32"),
            "esp32:esp32:esp32:PartitionScheme=custom"
        );
    }

    #[test]
    fn set_scheme_leaves_non_board_strings_untouched() {
        assert_eq!(set_partition_scheme_custom("not-an-fqbn"), "not-an-fqbn");
    }

    #[test]
    fn update_sketch_yaml_rewrites_all_fqbns_and_preserves_flash() {
        let (out, changed) = update_sketch_yaml(YAML_DEFAULT);
        assert!(changed);
        assert!(out.contains("default_fqbn: esp32:esp32:esp32s3:PartitionScheme=custom,FlashSize=8M"));
        assert!(out.contains("fqbn: esp32:esp32:esp32c3:PartitionScheme=custom"));
        assert!(out.contains("FlashSize=8M"));
        assert!(out.contains("profiles:"));
    }

    #[test]
    fn update_sketch_yaml_is_idempotent() {
        let (once, _) = update_sketch_yaml(YAML_DEFAULT);
        let (twice, changed_again) = update_sketch_yaml(&once);
        assert_eq!(once, twice);
        assert!(!changed_again);
    }

    #[test]
    fn update_sketch_yaml_preserves_indentation_and_trailing_newline() {
        let (out, _) = update_sketch_yaml(YAML_PROFILE_ONLY);
        assert!(out.contains("    fqbn: esp32:esp32:esp32:FlashSize=4M,PartitionScheme=custom"));
        assert!(out.ends_with('\n'));
    }

    #[test]
    fn update_sketch_yaml_normalizes_crlf_to_lf_and_stays_idempotent() {
        // Deliberate: like the ini/sdkconfig writers, edits rewrite CRLF→LF.
        let crlf = "default_fqbn: esp32:esp32:esp32s3:FlashSize=8M\r\nprofiles:\r\n";
        let (out, changed) = update_sketch_yaml(crlf);
        assert!(changed);
        assert!(!out.contains('\r'));
        assert!(out.contains("default_fqbn: esp32:esp32:esp32s3:FlashSize=8M,PartitionScheme=custom"));
        let (twice, changed_again) = update_sketch_yaml(&out);
        assert_eq!(out, twice);
        assert!(!changed_again);
    }

    #[test]
    fn read_context_with_sketch_yaml_detects_mcu_flash_and_is_updatable() {
        let dir = temp("read_yaml");
        std::fs::write(dir.join("sketch.yaml"), YAML_DEFAULT).unwrap();
        let ctx = ArduinoAdapter.read_context(&dir, 4).unwrap();
        assert_eq!(ctx.platform, Platform::Arduino);
        assert_eq!(ctx.mcu.as_deref(), Some("esp32s3"));
        assert_eq!(ctx.flash_size_mb, Some(8));
        assert!(ctx.config_updatable);
        assert_eq!(ctx.config_targets.len(), 1);
        assert_eq!(ctx.partition_offset, "0x8000");
        std::fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn read_context_accepts_sketch_yml_variant_and_labels_it() {
        let dir = temp("read_yml");
        std::fs::write(dir.join("sketch.yml"), YAML_DEFAULT).unwrap();
        let ctx = ArduinoAdapter.read_context(&dir, 4).unwrap();
        assert!(ctx.config_updatable);
        assert_eq!(ctx.config_targets.len(), 1);
        // The target reflects the actual file name, not a hardcoded "sketch.yaml".
        assert_eq!(ctx.config_targets[0].id, "sketch.yml");
        assert_eq!(ctx.config_targets[0].label, "sketch.yml");
        std::fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn read_context_reads_existing_partition_csv() {
        let dir = temp("read_existing_csv");
        std::fs::write(dir.join("Blink.ino"), "void setup(){}\n").unwrap();
        std::fs::write(dir.join("partitions.csv"), "nvs, data, nvs, 0x9000, 16K,\n").unwrap();
        let ctx = ArduinoAdapter.read_context(&dir, 4).unwrap();
        assert!(ctx.partition_file_exists);
        assert!(ctx.partition_content.contains("nvs, data, nvs"));
        std::fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn read_context_bare_sketch_is_not_updatable_and_warns() {
        let dir = temp("read_bare");
        std::fs::write(dir.join("Blink.ino"), "void setup(){}\n").unwrap();
        let ctx = ArduinoAdapter.read_context(&dir, 4).unwrap();
        assert!(ctx.mcu.is_none());
        assert!(ctx.flash_size_mb.is_none());
        assert!(!ctx.config_updatable);
        assert!(ctx.config_targets.is_empty());
        assert!(ctx.warnings.iter().any(|w| w.contains("No sketch.yaml")));
        assert!(ctx.partition_content.contains("factory, app, factory"));
        std::fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn apply_config_update_sets_partition_scheme_in_sketch_yaml() {
        let dir = temp("apply_yaml");
        std::fs::write(dir.join("sketch.yaml"), YAML_DEFAULT).unwrap();
        let params = ConfigUpdateParams {
            partition_filename: "partitions.csv",
            partition_offset: 0x8000,
            selected_targets: &["sketch.yaml".to_string()],
        };
        let result = ArduinoAdapter.apply_config_update(&dir, &params).unwrap();
        assert!(result.config_updated);
        let written = std::fs::read_to_string(dir.join("sketch.yaml")).unwrap();
        assert!(written.contains("PartitionScheme=custom"));
        let again = ArduinoAdapter.apply_config_update(&dir, &params).unwrap();
        assert!(!again.config_updated);
        std::fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn apply_config_update_bare_sketch_is_noop_with_guidance() {
        let dir = temp("apply_bare");
        std::fs::write(dir.join("Blink.ino"), "void setup(){}\n").unwrap();
        let params = ConfigUpdateParams {
            partition_filename: "partitions.csv",
            partition_offset: 0x8000,
            selected_targets: &[],
        };
        let result = ArduinoAdapter.apply_config_update(&dir, &params).unwrap();
        assert!(!result.config_updated);
        assert!(!result.warnings.is_empty());
        std::fs::remove_dir_all(&dir).ok();
    }
}
