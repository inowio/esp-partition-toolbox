use std::path::Path;

use crate::platform::{
    ConfigTarget, ConfigUpdateParams, ConfigUpdateResult, Platform, ProjectAdapter, ProjectContext,
};
use crate::{
    ensure_partition_sdkconfig, extract_flash_size_mb,
    extract_idf_target, format_hex, generate_default_partition_csv, read_idf_config_sources,
    select_sdkconfig_for_load, select_sdkconfig_for_save,
};

pub struct EspIdfAdapter;

impl ProjectAdapter for EspIdfAdapter {
    fn read_context(&self, project_dir: &Path, fallback_flash_mb: u32) -> Result<ProjectContext, String> {
        // CMakeLists.txt requirement enforced by the command's validate step.
        let selection = select_sdkconfig_for_load(project_dir)?;

        // Read-only resolution of the existing partition reference (no writes).
        let resolved = ensure_partition_sdkconfig(&selection, None, false, None)?;

        let sources = read_idf_config_sources(project_dir);
        let mcu = sources.iter().find_map(|c| extract_idf_target(c));
        let flash_size_mb = extract_flash_size_mb(&sources);

        let partition_file_path = project_dir.join(&resolved.partition_filename);
        let partition_file_exists = partition_file_path.exists();
        let partition_content = if partition_file_exists {
            std::fs::read_to_string(&partition_file_path)
                .map_err(|e| format!("Failed to read partition file: {e}"))?
        } else {
            generate_default_partition_csv(fallback_flash_mb, resolved.partition_offset)
        };

        let config_targets = selection
            .sdkconfig_files
            .iter()
            .map(|p| ConfigTarget {
                id: p.to_string_lossy().to_string(),
                label: p
                    .file_name()
                    .map(|n| n.to_string_lossy().to_string())
                    .unwrap_or_else(|| p.to_string_lossy().to_string()),
            })
            .collect();

        Ok(ProjectContext {
            platform: Platform::EspIdf,
            confidence: "high".to_string(),
            markers: vec!["sdkconfig.defaults".to_string()],
            mcu,
            flash_size_mb,
            partition_filename: resolved.partition_filename,
            partition_file_path: partition_file_path.to_string_lossy().to_string(),
            partition_content,
            partition_file_exists,
            partition_offset: format_hex(resolved.partition_offset),
            config_targets,
            config_updatable: true,
            warnings: Vec::new(),
        })
    }

    fn apply_config_update(&self, project_dir: &Path, params: &ConfigUpdateParams) -> Result<ConfigUpdateResult, String> {
        // The selected target id is the sdkconfig file path; reuse the existing
        // path-validated selection + upsert pipeline.
        let requested = params
            .selected_targets
            .first()
            .map(String::as_str)
            .unwrap_or("sdkconfig.defaults");
        let selection = select_sdkconfig_for_save(project_dir, requested)?;
        let result = ensure_partition_sdkconfig(&selection, Some(params.partition_filename), true, Some(params.partition_offset))?;

        let mut warnings = Vec::new();
        if project_dir.join("sdkconfig").is_file() {
            warnings.push(
                "A generated sdkconfig exists and may shadow sdkconfig.defaults until the next clean build."
                    .to_string(),
            );
        }

        Ok(ConfigUpdateResult {
            config_updated: result.sdkconfig_updated,
            warnings,
        })
    }
}
