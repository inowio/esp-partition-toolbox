use serde::Serialize;
use std::path::Path;

pub mod esp_idf;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum Platform {
    EspIdf,
    PlatformIo,
    Arduino,
}

impl Platform {
    pub fn as_str(self) -> &'static str {
        match self {
            Platform::EspIdf => "esp-idf",
            Platform::PlatformIo => "platformio",
            Platform::Arduino => "arduino",
        }
    }
}

#[derive(Debug, Clone, Serialize)]
pub struct PlatformDetection {
    pub platform: Platform,
    pub confidence: &'static str, // "high" | "medium" | "low"
    pub markers: Vec<String>,
}

/// Ordered first-match classifier (spec §6).
/// 1) platformio.ini -> PlatformIo
/// 2) CMakeLists.txt + (project.cmake include | main/ + sdkconfig*) -> EspIdf
/// 3) Folder/Folder.ino (or .pde) -> Arduino
pub fn detect_platform(project_dir: &Path) -> Result<PlatformDetection, String> {
    if project_dir.join("platformio.ini").is_file() {
        return Ok(PlatformDetection {
            platform: Platform::PlatformIo,
            confidence: "high",
            markers: vec!["platformio.ini".to_string()],
        });
    }

    let cmake = project_dir.join("CMakeLists.txt");
    if cmake.is_file() {
        let cmake_text = std::fs::read_to_string(&cmake).unwrap_or_default();
        let has_idf_include = cmake_text.contains("project.cmake") || cmake_text.contains("$ENV{IDF_PATH}");
        let has_main = project_dir.join("main").is_dir();
        let has_sdkconfig = project_dir.join("sdkconfig").is_file()
            || project_dir.join("sdkconfig.defaults").is_file()
            || sdkconfig_variant_exists(project_dir);
        if has_idf_include || (has_main && has_sdkconfig) {
            let mut markers = vec!["CMakeLists.txt".to_string()];
            if has_main {
                markers.push("main/".to_string());
            }
            if has_sdkconfig {
                markers.push("sdkconfig*".to_string());
            }
            return Ok(PlatformDetection {
                platform: Platform::EspIdf,
                confidence: if has_idf_include { "high" } else { "medium" },
                markers,
            });
        }
    }

    if let Some(sketch) = arduino_sketch_marker(project_dir) {
        return Ok(PlatformDetection {
            platform: Platform::Arduino,
            confidence: if sketch.matches_folder { "high" } else { "low" },
            markers: vec![sketch.file_name],
        });
    }

    Err("Unrecognized project. Expected a PlatformIO (platformio.ini), ESP-IDF (CMakeLists.txt + sdkconfig), or Arduino (.ino) project.".to_string())
}

fn sdkconfig_variant_exists(project_dir: &Path) -> bool {
    std::fs::read_dir(project_dir)
        .ok()
        .map(|entries| {
            entries.filter_map(Result::ok).any(|e| {
                e.file_name()
                    .to_str()
                    .map(|n| n.starts_with("sdkconfig.defaults."))
                    .unwrap_or(false)
            })
        })
        .unwrap_or(false)
}

struct SketchMarker {
    file_name: String,
    matches_folder: bool,
}

fn arduino_sketch_marker(project_dir: &Path) -> Option<SketchMarker> {
    let folder = project_dir.file_name()?.to_str()?.to_string();
    let entries = std::fs::read_dir(project_dir).ok()?;
    let mut first_sketch: Option<String> = None;
    for entry in entries.filter_map(Result::ok) {
        let name = entry.file_name().to_string_lossy().to_string();
        let lower = name.to_ascii_lowercase();
        if lower.ends_with(".ino") || lower.ends_with(".pde") {
            let stem = name.rsplit_once('.').map(|(s, _)| s).unwrap_or(&name);
            // Folder/sketch basename match is case-sensitive on purpose: an exact
            // match is high-confidence; a case-different .ino is only low-confidence.
            if stem == folder {
                return Some(SketchMarker { file_name: name, matches_folder: true });
            }
            first_sketch.get_or_insert(name);
        }
    }
    first_sketch.map(|file_name| SketchMarker { file_name, matches_folder: false })
}

/// A selectable place the partition config can be written (file for ESP-IDF,
/// env for PlatformIO). `id` is the stable value the UI returns in save requests.
#[derive(Debug, Clone, Serialize)]
pub struct ConfigTarget {
    pub id: String,
    pub label: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectContext {
    pub platform: Platform,
    pub confidence: String,
    pub markers: Vec<String>,
    pub mcu: Option<String>,
    pub flash_size_mb: Option<u32>,
    pub partition_filename: String,
    pub partition_file_path: String,
    pub partition_content: String,
    pub partition_file_exists: bool,
    pub partition_offset: String,
    pub config_targets: Vec<ConfigTarget>,
    pub config_updatable: bool,
    pub warnings: Vec<String>,
}

pub struct ConfigUpdateParams<'a> {
    pub partition_filename: &'a str,
    pub partition_offset: u64,
    pub selected_targets: &'a [String],
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ConfigUpdateResult {
    pub config_updated: bool,
    pub warnings: Vec<String>,
}

/// Per-platform read/write behavior behind the two commands.
pub trait ProjectAdapter {
    /// Read everything the UI needs to populate the editor. Read-only.
    fn read_context(&self, project_dir: &Path, fallback_flash_mb: u32) -> Result<ProjectContext, String>;

    /// Apply the config-file edits (opt-in). Does NOT write the CSV — the
    /// command writes the CSV; this only touches config files.
    fn apply_config_update(&self, project_dir: &Path, params: &ConfigUpdateParams) -> Result<ConfigUpdateResult, String>;
}

/// Resolve the adapter for a platform. P1 only implements ESP-IDF; the others
/// return an explicit "not yet supported" error so the commands fail cleanly.
pub fn adapter_for(platform: Platform) -> Result<Box<dyn ProjectAdapter>, String> {
    match platform {
        Platform::EspIdf => Ok(Box::new(esp_idf::EspIdfAdapter)),
        Platform::PlatformIo => Err("PlatformIO support is not available yet.".to_string()),
        Platform::Arduino => Err("Arduino support is not available yet.".to_string()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    fn temp(label: &str) -> std::path::PathBuf {
        use std::sync::atomic::{AtomicU64, Ordering};
        static C: AtomicU64 = AtomicU64::new(0);
        let nanos = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_nanos();
        let seq = C.fetch_add(1, Ordering::Relaxed);
        let dir = std::env::temp_dir().join(format!("ept_detect_{label}_{nanos}_{seq}"));
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn detects_platformio_even_with_cmake() {
        let d = temp("pio");
        fs::write(d.join("platformio.ini"), "[env:esp32s3]\nplatform = espressif32\n").unwrap();
        // Add a full ESP-IDF layout so the CMake branch WOULD fire if ordering were wrong.
        fs::write(d.join("CMakeLists.txt"), "cmake_minimum_required(VERSION 3.16)\n").unwrap();
        fs::create_dir_all(d.join("main")).unwrap();
        fs::write(d.join("sdkconfig.defaults"), "").unwrap();
        assert_eq!(detect_platform(&d).unwrap().platform, Platform::PlatformIo);
        fs::remove_dir_all(&d).ok();
    }

    #[test]
    fn detects_esp_idf_via_main_and_sdkconfig() {
        let d = temp("idf");
        fs::write(d.join("CMakeLists.txt"), "cmake_minimum_required(VERSION 3.16)\n").unwrap();
        fs::create_dir_all(d.join("main")).unwrap();
        fs::write(d.join("sdkconfig.defaults"), "").unwrap();
        assert_eq!(detect_platform(&d).unwrap().platform, Platform::EspIdf);
        fs::remove_dir_all(&d).ok();
    }

    #[test]
    fn detects_arduino_when_sketch_matches_folder() {
        let parent = temp("ard");
        let sketch_dir = parent.join("Blink");
        fs::create_dir_all(&sketch_dir).unwrap();
        fs::write(sketch_dir.join("Blink.ino"), "void setup(){}\n").unwrap();
        let det = detect_platform(&sketch_dir).unwrap();
        assert_eq!(det.platform, Platform::Arduino);
        assert_eq!(det.confidence, "high");
        fs::remove_dir_all(&parent).ok();
    }

    #[test]
    fn unrecognized_project_errors() {
        let d = temp("none");
        fs::write(d.join("README.md"), "hi").unwrap();
        assert!(detect_platform(&d).is_err());
        fs::remove_dir_all(&d).ok();
    }

    #[test]
    fn esp_idf_adapter_reads_context_with_mcu_and_flash() {
        let d = temp("idf_ctx");
        fs::write(d.join("CMakeLists.txt"), "cmake_minimum_required(VERSION 3.16)\n").unwrap();
        fs::create_dir_all(d.join("main")).unwrap();
        fs::write(
            d.join("sdkconfig.defaults"),
            "CONFIG_IDF_TARGET=\"esp32s3\"\nCONFIG_ESPTOOLPY_FLASHSIZE=\"8MB\"\n",
        )
        .unwrap();

        let adapter = esp_idf::EspIdfAdapter;
        let ctx = adapter.read_context(&d, 4).unwrap();
        assert_eq!(ctx.platform, Platform::EspIdf);
        assert_eq!(ctx.mcu.as_deref(), Some("esp32s3"));
        assert_eq!(ctx.flash_size_mb, Some(8));
        assert!(ctx.config_updatable);
        fs::remove_dir_all(&d).ok();
    }
}
