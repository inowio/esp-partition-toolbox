use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};

const DEFAULT_PARTITION_FILENAME: &str = "partitions.csv";
const DEFAULT_PARTITION_OFFSET: u64 = 0x8000;
const DEFAULT_PARTITION_START: u64 = 0x10000;
const SECTOR_SIZE: u64 = 0x1000;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct LoadProjectResponse {
    project_path: String,
    sdkconfig_file: String,
    sdkconfig_files: Vec<String>,
    partition_filename: String,
    partition_file_path: String,
    partition_content: String,
    partition_file_exists: bool,
    sdkconfig_updated: bool,
    partition_offset: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SaveProjectRequest {
    project_path: String,
    sdkconfig_file: String,
    partition_filename: String,
    partition_content: String,
    sync_sdkconfig: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct SaveProjectResponse {
    partition_file_path: String,
    sdkconfig_updated: bool,
}

struct SdkconfigSelection {
    sdkconfig_file: PathBuf,
    sdkconfig_files: Vec<PathBuf>,
}

struct SdkconfigEnsureResult {
    sdkconfig_file: PathBuf,
    sdkconfig_files: Vec<PathBuf>,
    partition_filename: String,
    partition_offset: u64,
    sdkconfig_updated: bool,
}

#[tauri::command]
fn load_esp_project(project_path: String, flash_size_mb: u32, sync_sdkconfig: bool) -> Result<LoadProjectResponse, String> {
    let project_dir = PathBuf::from(&project_path);
    validate_project_root(&project_dir)?;

    let selection = select_sdkconfig_for_load(&project_dir)?;
    let sdkconfig_result = ensure_partition_sdkconfig(&selection, None, sync_sdkconfig)?;

    let partition_file_path = project_dir.join(&sdkconfig_result.partition_filename);
    let partition_file_exists = partition_file_path.exists();

    let partition_content = if partition_file_exists {
        fs::read_to_string(&partition_file_path).map_err(|error| format!("Failed to read partition file: {error}"))?
    } else {
        generate_default_partition_csv(flash_size_mb)
    };

    Ok(LoadProjectResponse {
        project_path: project_dir.to_string_lossy().to_string(),
        sdkconfig_file: sdkconfig_result.sdkconfig_file.to_string_lossy().to_string(),
        sdkconfig_files: sdkconfig_result
            .sdkconfig_files
            .iter()
            .map(|path| path.to_string_lossy().to_string())
            .collect(),
        partition_filename: sdkconfig_result.partition_filename,
        partition_file_path: partition_file_path.to_string_lossy().to_string(),
        partition_content,
        partition_file_exists,
        sdkconfig_updated: sdkconfig_result.sdkconfig_updated,
        partition_offset: format_hex(sdkconfig_result.partition_offset),
    })
}

#[tauri::command]
fn save_project_state(request: SaveProjectRequest) -> Result<SaveProjectResponse, String> {
    let project_dir = PathBuf::from(&request.project_path);
    validate_project_root(&project_dir)?;

    let selection = select_sdkconfig_for_save(&project_dir, &request.sdkconfig_file)?;
    let sdkconfig_result = ensure_partition_sdkconfig(
        &selection,
        Some(request.partition_filename.as_str()),
        request.sync_sdkconfig,
    )?;

    let partition_file_path = project_dir.join(&sdkconfig_result.partition_filename);

    fs::write(&partition_file_path, request.partition_content)
        .map_err(|error| format!("Failed to save partition file: {error}"))?;

    Ok(SaveProjectResponse {
        partition_file_path: partition_file_path.to_string_lossy().to_string(),
        sdkconfig_updated: sdkconfig_result.sdkconfig_updated,
    })
}

fn validate_project_root(project_dir: &Path) -> Result<(), String> {
    if !project_dir.exists() || !project_dir.is_dir() {
        return Err("Selected folder does not exist or is not a directory.".to_string());
    }

    let cmake_file = project_dir.join("CMakeLists.txt");
    if !cmake_file.exists() {
        return Err("CMakeLists.txt not found. This does not look like an ESP-IDF project.".to_string());
    }

    Ok(())
}

fn discover_sdkconfig_defaults_files(project_dir: &Path) -> Result<Vec<PathBuf>, String> {
    let mut files: Vec<PathBuf> = Vec::new();

    let defaults_file = project_dir.join("sdkconfig.defaults");
    if defaults_file.exists() {
        files.push(defaults_file);
    }

    let mut variant_defaults: Vec<PathBuf> = fs::read_dir(project_dir)
        .map_err(|error| format!("Failed to scan project folder: {error}"))?
        .filter_map(Result::ok)
        .map(|entry| entry.path())
        .filter(|path| {
            path.file_name()
                .and_then(|name| name.to_str())
                .map(|name| name.starts_with("sdkconfig.defaults."))
                .unwrap_or(false)
        })
        .collect();

    variant_defaults.sort();
    files.extend(variant_defaults);

    if files.is_empty() {
        return Err("Invalid ESP-IDF project. No sdkconfig.defaults files found. Expected sdkconfig.defaults or sdkconfig.defaults.*".to_string());
    }

    Ok(files)
}

fn select_sdkconfig_for_load(project_dir: &Path) -> Result<SdkconfigSelection, String> {
    let sdkconfig_files = discover_sdkconfig_defaults_files(project_dir)?;

    let contents: Vec<String> = sdkconfig_files
        .iter()
        .map(|file| {
            fs::read_to_string(file)
                .map_err(|error| format!("Failed to read sdkconfig file {}: {error}", file.to_string_lossy()))
        })
        .collect::<Result<Vec<_>, _>>()?;

    let source_index = resolve_partition_settings(&contents).2;
    let fallback_file = select_sdkconfig_defaults_file(&sdkconfig_files)?;

    let sdkconfig_file = source_index
        .and_then(|index| sdkconfig_files.get(index).cloned())
        .unwrap_or(fallback_file);

    Ok(SdkconfigSelection {
        sdkconfig_file,
        sdkconfig_files,
    })
}

fn select_sdkconfig_for_save(project_dir: &Path, requested_file: &str) -> Result<SdkconfigSelection, String> {
    let sdkconfig_files = discover_sdkconfig_defaults_files(project_dir)?;

    let requested_path = PathBuf::from(requested_file);

    let selected = sdkconfig_files
        .iter()
        .find(|path| path == &&requested_path)
        .cloned()
        .unwrap_or_else(|| project_dir.join(requested_file));

    if !selected.starts_with(project_dir) {
        return Err("Selected sdkconfig file must be inside the project folder.".to_string());
    }

    let file_name = selected
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or_default();

    if !file_name.eq_ignore_ascii_case("sdkconfig.defaults") && !file_name.starts_with("sdkconfig.defaults.") {
        return Err("Selected sdkconfig file must be sdkconfig.defaults or sdkconfig.defaults.*".to_string());
    }

    Ok(SdkconfigSelection {
        sdkconfig_file: selected,
        sdkconfig_files,
    })
}

fn ensure_partition_sdkconfig(
    selection: &SdkconfigSelection,
    preferred_filename: Option<&str>,
    write_changes: bool,
) -> Result<SdkconfigEnsureResult, String> {
    let sdkconfig_files = &selection.sdkconfig_files;

    let mut discovered_contents: Vec<String> = Vec::with_capacity(sdkconfig_files.len());

    for file in sdkconfig_files {
        let content = fs::read_to_string(file)
            .map_err(|error| format!("Failed to read sdkconfig file {}: {error}", file.to_string_lossy()))?;
        discovered_contents.push(content);
    }

    let (discovered_filename, partition_offset, _) = resolve_partition_settings(&discovered_contents);
    let partition_filename = preferred_filename
        .map(str::trim)
        .filter(|name| !name.is_empty())
        .map(std::string::ToString::to_string)
        .unwrap_or(discovered_filename);

    let sdkconfig_file = selection.sdkconfig_file.clone();

    if write_changes {
        for other_file in sdkconfig_files.iter().filter(|file| **file != sdkconfig_file) {
            let content = fs::read_to_string(other_file)
                .map_err(|error| format!("Failed to read sdkconfig file: {error}"))?;
            let cleaned_content = remove_partition_entries(&content);
            if cleaned_content != content {
                fs::write(other_file, cleaned_content)
                    .map_err(|error| format!("Failed to update sdkconfig file: {error}"))?;
            }
        }
    }

    let selected_content = if sdkconfig_file.exists() {
        fs::read_to_string(&sdkconfig_file)
            .map_err(|error| format!("Failed to read sdkconfig file: {error}"))?
    } else {
        String::new()
    };

    let normalized_content = normalize_sdkconfig_partition_content(
        &selected_content,
        &partition_filename,
        partition_offset,
    );

    let mut sdkconfig_updated = false;

    if write_changes && normalized_content != selected_content {
        fs::write(&sdkconfig_file, normalized_content)
            .map_err(|error| format!("Failed to update sdkconfig file: {error}"))?;

        sdkconfig_updated = true;
    }

    Ok(SdkconfigEnsureResult {
        sdkconfig_file,
        sdkconfig_files: sdkconfig_files.to_vec(),
        partition_filename,
        partition_offset,
        sdkconfig_updated,
    })
}

fn select_sdkconfig_defaults_file(sdkconfig_files: &[PathBuf]) -> Result<PathBuf, String> {
    if let Some(defaults_file) = sdkconfig_files.iter().find(|path| {
        path.file_name()
            .and_then(|name| name.to_str())
            .map(|name| name.eq_ignore_ascii_case("sdkconfig.defaults"))
            .unwrap_or(false)
    }) {
        return Ok(defaults_file.to_path_buf());
    }

    let parent = sdkconfig_files
        .first()
        .and_then(|path| path.parent())
        .ok_or_else(|| "No sdkconfig file available to update partition config.".to_string())?;

    Ok(parent.join("sdkconfig.defaults"))
}

fn extract_config_string(content: &str, key: &str) -> Option<String> {
    for line in content.lines() {
        let trimmed = line.trim();
        if trimmed.starts_with('#') {
            continue;
        }

        if let Some(value) = trimmed.strip_prefix(&format!("{key}=")) {
            return Some(value.trim().trim_matches('"').to_string());
        }
    }

    None
}

fn extract_config_u64(content: &str, key: &str) -> Option<u64> {
    let raw_value = extract_config_string(content, key)?;
    parse_u64_value(&raw_value)
}

fn extract_config_enabled(content: &str, key: &str) -> bool {
    let Some(value) = extract_config_string(content, key) else {
        return false;
    };

    matches!(value.trim().to_ascii_lowercase().as_str(), "y" | "1" | "true")
}

fn resolve_partition_settings(contents: &[String]) -> (String, u64, Option<usize>) {
    for (index, content) in contents.iter().enumerate() {
        let custom_enabled = extract_config_enabled(content, "CONFIG_PARTITION_TABLE_CUSTOM");
        let md5_enabled = extract_config_enabled(content, "CONFIG_PARTITION_TABLE_MD5");

        let custom_filename = extract_config_string(content, "CONFIG_PARTITION_TABLE_CUSTOM_FILENAME")
            .map(|value| value.trim().to_string())
            .filter(|value| !value.is_empty());
        let table_filename = extract_config_string(content, "CONFIG_PARTITION_TABLE_FILENAME")
            .map(|value| value.trim().to_string())
            .filter(|value| !value.is_empty());
        let candidate_offset = extract_config_u64(content, "CONFIG_PARTITION_TABLE_OFFSET");

        let has_matching_filename_pair = match (&custom_filename, &table_filename) {
            (Some(custom), Some(table)) => custom.eq_ignore_ascii_case(table),
            _ => false,
        };

        if custom_enabled && md5_enabled && has_matching_filename_pair && candidate_offset.is_some() {
            return (
                custom_filename.expect("custom filename present when filename pair is valid"),
                candidate_offset.expect("partition offset present when candidate is selected"),
                Some(index),
            );
        }
    }

    (
        DEFAULT_PARTITION_FILENAME.to_string(),
        DEFAULT_PARTITION_OFFSET,
        None,
    )
}

fn normalize_sdkconfig_partition_content(
    content: &str,
    partition_filename: &str,
    partition_offset: u64,
) -> String {
    let mut retained_lines: Vec<String> = Vec::new();
    let lines: Vec<&str> = content.lines().collect();

    let mut index = 0;
    while index < lines.len() {
        let line = lines[index];
        let trimmed = line.trim();

        if trimmed.eq_ignore_ascii_case("# Partition Table") {
            if retained_lines
                .last()
                .map(|previous| previous.trim() == "#")
                .unwrap_or(false)
            {
                retained_lines.pop();
            }

            index += 1;
            while index < lines.len() {
                let inner_trimmed = lines[index].trim();
                if inner_trimmed.eq_ignore_ascii_case("# end of Partition Table") {
                    index += 1;
                    break;
                }
                index += 1;
            }
            continue;
        }

        if trimmed.eq_ignore_ascii_case("# end of Partition Table") || is_partition_key_line(trimmed) {
            index += 1;
            continue;
        }

        retained_lines.push(line.to_string());
        index += 1;
    }

    while retained_lines
        .last()
        .map(|line| line.trim().is_empty())
        .unwrap_or(false)
    {
        retained_lines.pop();
    }

    let mut normalized = String::new();
    if !retained_lines.is_empty() {
        normalized.push_str(&retained_lines.join("\n"));
        normalized.push('\n');
    }

    normalized.push_str(&build_partition_block(partition_filename, partition_offset));
    normalized
}

fn remove_partition_entries(content: &str) -> String {
    let mut retained_lines: Vec<String> = Vec::new();
    let lines: Vec<&str> = content.lines().collect();

    let mut index = 0;
    while index < lines.len() {
        let line = lines[index];
        let trimmed = line.trim();

        if trimmed.eq_ignore_ascii_case("# Partition Table") {
            if retained_lines
                .last()
                .map(|previous| previous.trim() == "#")
                .unwrap_or(false)
            {
                retained_lines.pop();
            }

            index += 1;
            while index < lines.len() {
                let inner_trimmed = lines[index].trim();
                if inner_trimmed.eq_ignore_ascii_case("# end of Partition Table") {
                    index += 1;
                    break;
                }
                index += 1;
            }
            continue;
        }

        if trimmed.eq_ignore_ascii_case("# end of Partition Table") || is_partition_key_line(trimmed) {
            index += 1;
            continue;
        }

        retained_lines.push(line.to_string());
        index += 1;
    }

    while retained_lines
        .last()
        .map(|line| line.trim().is_empty())
        .unwrap_or(false)
    {
        retained_lines.pop();
    }

    if retained_lines.is_empty() {
        String::new()
    } else {
        format!("{}\n", retained_lines.join("\n"))
    }
}

fn is_partition_key_line(trimmed_line: &str) -> bool {
    trimmed_line.starts_with("CONFIG_PARTITION_TABLE_CUSTOM=")
        || trimmed_line.starts_with("CONFIG_PARTITION_TABLE_CUSTOM_FILENAME=")
        || trimmed_line.starts_with("CONFIG_PARTITION_TABLE_FILENAME=")
        || trimmed_line.starts_with("CONFIG_PARTITION_TABLE_OFFSET=")
        || trimmed_line.starts_with("CONFIG_PARTITION_TABLE_MD5=")
}

fn parse_u64_value(value: &str) -> Option<u64> {
    let trimmed = value.trim();

    if let Some(hex_value) = trimmed.strip_prefix("0x").or_else(|| trimmed.strip_prefix("0X")) {
        return u64::from_str_radix(hex_value, 16).ok();
    }

    trimmed.parse::<u64>().ok()
}

fn align_up(value: u64, alignment: u64) -> u64 {
    value.div_ceil(alignment) * alignment
}

fn align_down(value: u64, alignment: u64) -> u64 {
    (value / alignment) * alignment
}

fn format_hex(value: u64) -> String {
    format!("0x{:X}", value)
}

fn format_size_unit(bytes: u64) -> String {
    if bytes >= 1024 * 1024 && bytes % (1024 * 1024) == 0 {
        return format!("{}M", bytes / (1024 * 1024));
    }
    if bytes >= 1024 && bytes % 1024 == 0 {
        return format!("{}K", bytes / 1024);
    }
    format_hex(bytes)
}

fn build_partition_block(filename: &str, partition_offset: u64) -> String {
    format!(
        "\n#\n# Partition Table\n#\nCONFIG_PARTITION_TABLE_CUSTOM=y\nCONFIG_PARTITION_TABLE_CUSTOM_FILENAME=\"{filename}\"\nCONFIG_PARTITION_TABLE_FILENAME=\"{filename}\"\nCONFIG_PARTITION_TABLE_OFFSET={}\nCONFIG_PARTITION_TABLE_MD5=y\n# end of Partition Table\n",
        format_hex(partition_offset)
    )
}

fn generate_default_partition_csv(flash_size_mb: u32) -> String {
    let flash_bytes = u64::from(flash_size_mb.max(2)) * 1024 * 1024;

    let nvs_size: u64 = 16 * 1024;
    let phy_size: u64 = 4 * 1024;
    let base_size = nvs_size + phy_size;

    let app_start = align_up(DEFAULT_PARTITION_START + base_size, 0x10000);
    let app_size = align_down(flash_bytes.saturating_sub(app_start), SECTOR_SIZE).max(SECTOR_SIZE);

    let nvs_offset = DEFAULT_PARTITION_START;
    let phy_offset = align_up(nvs_offset + nvs_size, SECTOR_SIZE);
    let app_offset = align_up(phy_offset + phy_size, 0x10000);

    let mut lines = vec![
        "# Name, Type, SubType, Offset, Size, Flags".to_string(),
        format!("# Generated by ESP Partition Toolbox for {} MB flash", flash_size_mb),
        format!(
            "nvs, data, nvs, {}, {},",
            format_hex(nvs_offset),
            format_size_unit(nvs_size)
        ),
        format!(
            "phy_init, data, phy, {}, {},",
            format_hex(phy_offset),
            format_size_unit(phy_size)
        ),
        format!(
            "factory, app, factory, {}, {},",
            format_hex(app_offset),
            format_size_unit(app_size)
        ),
    ];

    lines.push(String::new());
    lines.join("\n")
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![load_esp_project, save_project_state])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_u64_value_supports_decimal_and_hex() {
        assert_eq!(parse_u64_value("4096"), Some(4096));
        assert_eq!(parse_u64_value("0x1000"), Some(0x1000));
        assert_eq!(parse_u64_value("0X1D0000"), Some(0x1D0000));
        assert_eq!(parse_u64_value("bad-value"), None);
    }

    #[test]
    fn build_partition_block_uses_given_filename_and_offset() {
        let block = build_partition_block("custom.csv", 0x9000);

        assert!(block.contains("CONFIG_PARTITION_TABLE_CUSTOM_FILENAME=\"custom.csv\""));
        assert!(block.contains("CONFIG_PARTITION_TABLE_FILENAME=\"custom.csv\""));
        assert!(block.contains("CONFIG_PARTITION_TABLE_OFFSET=0x9000"));
    }

    #[test]
    fn default_partition_csv_contains_required_rows() {
        let content = generate_default_partition_csv(8);

        assert!(content.contains("nvs, data, nvs"));
        assert!(content.contains("phy_init, data, phy"));
        assert!(content.contains("factory, app, factory"));
        assert!(!content.contains("otadata, data, ota"));
        assert!(!content.contains("spiffs, data, spiffs"));
        assert!(content.ends_with('\n'));
    }

    #[test]
    fn default_partition_csv_has_64kb_aligned_app_offset() {
        for mb in [2, 4, 8, 16, 32] {
            let content = generate_default_partition_csv(mb);
            let factory_line = content.lines().find(|l| l.starts_with("factory")).unwrap();
            let offset_str = factory_line.split(',').nth(3).unwrap().trim();
            let offset = u64::from_str_radix(offset_str.trim_start_matches("0x").trim_start_matches("0X"), 16).unwrap();
            assert_eq!(offset % 0x10000, 0, "App offset {offset_str} is not 64KB aligned for {mb}MB flash");
        }
    }

    #[test]
    fn default_partition_csv_never_exceeds_flash_boundary() {
        for mb in [2, 4, 8, 16, 32, 64, 128, 256, 512] {
            let content = generate_default_partition_csv(mb);
            let flash_bytes = u64::from(mb) * 1024 * 1024;

            let mut max_end: u64 = 0;
            for line in content.lines().filter(|line| !line.trim().is_empty() && !line.starts_with('#')) {
                let parts: Vec<&str> = line.split(',').map(|cell| cell.trim()).collect();
                let offset = parse_u64_value(parts[3]).expect("offset parse");
                let size = parse_u64_value(parts[4]).unwrap_or_else(|| {
                    let unit = parts[4].chars().last().unwrap_or(' ');
                    let number: u64 = parts[4][..parts[4].len().saturating_sub(1)].parse().unwrap_or(0);
                    match unit {
                        'K' | 'k' => number * 1024,
                        'M' | 'm' => number * 1024 * 1024,
                        _ => 0,
                    }
                });
                max_end = max_end.max(offset + size);
            }

            assert!(
                max_end <= flash_bytes,
                "Generated layout exceeds flash for {mb}MB: end=0x{max_end:X}, flash=0x{flash_bytes:X}"
            );
        }
    }

    #[test]
    fn resolve_partition_settings_prefers_existing_partition_keys_from_any_sdkconfig() {
        let contents = vec![
            "CONFIG_IDF_TARGET=\"esp32\"\n".to_string(),
            "CONFIG_PARTITION_TABLE_CUSTOM=y\nCONFIG_PARTITION_TABLE_CUSTOM_FILENAME=\"partfile.csv\"\nCONFIG_PARTITION_TABLE_FILENAME=\"partfile.csv\"\nCONFIG_PARTITION_TABLE_OFFSET=0x9000\nCONFIG_PARTITION_TABLE_MD5=y\n"
                .to_string(),
        ];

        let (filename, offset, source_index) = resolve_partition_settings(&contents);
        assert_eq!(filename, "partfile.csv");
        assert_eq!(offset, 0x9000);
        assert_eq!(source_index, Some(1));
    }

    #[test]
    fn resolve_partition_settings_falls_back_to_default_when_keys_missing() {
        let contents = vec!["CONFIG_IDF_TARGET=\"esp32\"\n".to_string()];

        let (filename, offset, source_index) = resolve_partition_settings(&contents);
        assert_eq!(filename, "partitions.csv");
        assert_eq!(offset, DEFAULT_PARTITION_OFFSET);
        assert_eq!(source_index, None);
    }

    #[test]
    fn normalize_sdkconfig_partition_content_removes_duplicate_partition_blocks() {
        let original = "CONFIG_IDF_TARGET=\"esp32\"\n\n#\n# Partition Table\n#\nCONFIG_PARTITION_TABLE_CUSTOM=y\nCONFIG_PARTITION_TABLE_CUSTOM_FILENAME=\"partfile.csv\"\nCONFIG_PARTITION_TABLE_FILENAME=\"partfile.csv\"\nCONFIG_PARTITION_TABLE_OFFSET=0x8000\nCONFIG_PARTITION_TABLE_MD5=y\n# end of Partition Table\n\n#\n# Partition Table\n#\nCONFIG_PARTITION_TABLE_CUSTOM=y\nCONFIG_PARTITION_TABLE_CUSTOM_FILENAME=\"partitions.csv\"\nCONFIG_PARTITION_TABLE_FILENAME=\"partitions.csv\"\nCONFIG_PARTITION_TABLE_OFFSET=0x8000\nCONFIG_PARTITION_TABLE_MD5=y\n# end of Partition Table\n";

        let normalized = normalize_sdkconfig_partition_content(original, "partitions.csv", 0x8000);

        assert_eq!(normalized.matches("# Partition Table").count(), 1);
        assert_eq!(normalized.matches("CONFIG_PARTITION_TABLE_CUSTOM_FILENAME=").count(), 1);
        assert!(normalized.contains("CONFIG_PARTITION_TABLE_CUSTOM_FILENAME=\"partitions.csv\""));
        assert!(!normalized.contains("CONFIG_PARTITION_TABLE_CUSTOM_FILENAME=\"partfile.csv\""));

        let normalized_twice = normalize_sdkconfig_partition_content(&normalized, "partitions.csv", 0x8000);
        assert_eq!(normalized, normalized_twice);
    }

    #[test]
    fn remove_partition_entries_removes_block_and_keys() {
        let original = "CONFIG_IDF_TARGET=\"esp32\"\n#\n# Partition Table\n#\nCONFIG_PARTITION_TABLE_CUSTOM=y\nCONFIG_PARTITION_TABLE_CUSTOM_FILENAME=\"partfile.csv\"\nCONFIG_PARTITION_TABLE_FILENAME=\"partfile.csv\"\nCONFIG_PARTITION_TABLE_OFFSET=0x8000\nCONFIG_PARTITION_TABLE_MD5=y\n# end of Partition Table\nCONFIG_FOO=y\n";

        let cleaned = remove_partition_entries(original);
        assert!(!cleaned.contains("# Partition Table"));
        assert!(!cleaned.contains("CONFIG_PARTITION_TABLE_CUSTOM_FILENAME"));
        assert!(cleaned.contains("CONFIG_IDF_TARGET"));
        assert!(cleaned.contains("CONFIG_FOO=y"));
    }

    #[test]
    fn format_size_unit_uses_km_suffixes() {
        assert_eq!(format_size_unit(64 * 1024), "64K");
        assert_eq!(format_size_unit(1024 * 1024), "1M");
        assert_eq!(format_size_unit(1536 * 1024), "1536K");
        assert_eq!(format_size_unit(0x1234), "0x1234");
    }
}
