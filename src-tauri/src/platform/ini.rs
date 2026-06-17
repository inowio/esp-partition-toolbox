//! Minimal line-oriented INI helpers for editing platformio.ini without a
//! dependency. Mirrors the sdkconfig line-scan approach. Does NOT resolve
//! `${...}` interpolation or `extends` — reads are best-effort; writes target
//! the literal section requested.

/// Section header names (without brackets), in file order.
pub fn section_headers(content: &str) -> Vec<String> {
    content
        .lines()
        .filter_map(|line| {
            let t = line.trim();
            if t.starts_with('[') && t.ends_with(']') && t.len() > 2 {
                Some(t[1..t.len() - 1].to_string())
            } else {
                None
            }
        })
        .collect()
}

/// Names from `[env:NAME]` headers, in order.
pub fn env_names(content: &str) -> Vec<String> {
    section_headers(content)
        .into_iter()
        .filter_map(|h| h.strip_prefix("env:").map(str::to_string))
        .collect()
}

/// `[start, end)` line index range of a section (end = next header or EOF).
fn section_range(lines: &[&str], header: &str) -> Option<(usize, usize)> {
    let target = format!("[{header}]");
    let start = lines.iter().position(|l| l.trim() == target)?;
    let mut end = lines.len();
    for (offset, line) in lines.iter().enumerate().skip(start + 1) {
        let t = line.trim();
        if t.starts_with('[') && t.ends_with(']') && t.len() > 2 {
            end = offset;
            break;
        }
    }
    Some((start, end))
}

/// Does `trimmed` start with `key` immediately followed (after optional spaces)
/// by `=`? Guards against prefix collisions (`board` vs `board_build.x`).
fn line_is_key(trimmed: &str, key: &str) -> bool {
    trimmed
        .strip_prefix(key)
        .map(|rest| rest.trim_start().starts_with('='))
        .unwrap_or(false)
}

/// First non-comment value of `key` within `[header]`, trimmed.
pub fn get_in_section(content: &str, header: &str, key: &str) -> Option<String> {
    let lines: Vec<&str> = content.lines().collect();
    let (start, end) = section_range(&lines, header)?;
    for line in &lines[start + 1..end] {
        let t = line.trim();
        if t.starts_with(';') || t.starts_with('#') {
            continue;
        }
        if line_is_key(t, key) {
            let value = t[key.len()..].trim_start();
            let value = value.strip_prefix('=').unwrap_or(value).trim();
            return Some(value.to_string());
        }
    }
    None
}

/// Upsert `key = value` inside `[header]`: replace the first non-comment
/// occurrence in place, else insert after the header; create the section if it
/// is missing. Idempotent.
pub fn upsert_in_section(content: &str, header: &str, key: &str, value: &str) -> String {
    let mut lines: Vec<String> = content.lines().map(str::to_string).collect();
    let new_line = format!("{key} = {value}");

    let range = {
        let refs: Vec<&str> = lines.iter().map(String::as_str).collect();
        section_range(&refs, header)
    };

    match range {
        Some((start, end)) => {
            let mut found: Option<usize> = None;
            for i in (start + 1)..end {
                let t = lines[i].trim();
                if t.starts_with(';') || t.starts_with('#') {
                    continue;
                }
                if line_is_key(t, key) {
                    found = Some(i);
                    break;
                }
            }
            match found {
                Some(i) => lines[i] = new_line,
                None => lines.insert(start + 1, new_line),
            }
        }
        None => {
            if let Some(last) = lines.last() {
                if !last.trim().is_empty() {
                    lines.push(String::new());
                }
            }
            lines.push(format!("[{header}]"));
            lines.push(new_line);
        }
    }

    let mut out = lines.join("\n");
    if content.ends_with('\n') && !out.ends_with('\n') {
        out.push('\n');
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    const SAMPLE: &str = "[platformio]\ndefault_envs = esp32s3\n\n[env]\nplatform = espressif32\n\n[env:esp32s3]\nboard = esp32-s3-devkitc-1\nboard_build.partitions = partitions.csv\n\n[env:esp32c3]\nboard = esp32-c3-devkitm-1\n";

    #[test]
    fn env_names_lists_env_sections_only() {
        assert_eq!(env_names(SAMPLE), vec!["esp32s3".to_string(), "esp32c3".to_string()]);
    }

    #[test]
    fn get_in_section_reads_a_key_with_dots() {
        assert_eq!(get_in_section(SAMPLE, "env:esp32s3", "board_build.partitions").as_deref(), Some("partitions.csv"));
        assert_eq!(get_in_section(SAMPLE, "env:esp32s3", "board").as_deref(), Some("esp32-s3-devkitc-1"));
        assert_eq!(get_in_section(SAMPLE, "platformio", "default_envs").as_deref(), Some("esp32s3"));
    }

    #[test]
    fn get_in_section_does_not_match_a_key_prefix() {
        // "board" must not match "board_build.partitions"
        let s = "[env:x]\nboard_build.partitions = a.csv\n";
        assert_eq!(get_in_section(s, "env:x", "board"), None);
    }

    #[test]
    fn get_in_section_skips_comments_and_missing() {
        let s = "[env:x]\n; board = commented\n# board_build.flash_size = 8MB\n";
        assert_eq!(get_in_section(s, "env:x", "board"), None);
        assert_eq!(get_in_section(s, "env:x", "board_build.flash_size"), None);
        assert_eq!(get_in_section(s, "env:missing", "board"), None);
    }

    #[test]
    fn upsert_replaces_existing_key_in_place_and_is_idempotent() {
        let updated = upsert_in_section(SAMPLE, "env:esp32s3", "board_build.partitions", "custom.csv");
        assert!(updated.contains("board_build.partitions = custom.csv"));
        assert!(!updated.contains("board_build.partitions = partitions.csv"));
        // only one occurrence
        assert_eq!(updated.matches("board_build.partitions").count(), 1);
        // idempotent
        let again = upsert_in_section(&updated, "env:esp32s3", "board_build.partitions", "custom.csv");
        assert_eq!(updated, again);
    }

    #[test]
    fn upsert_inserts_key_when_absent_in_the_right_section() {
        let updated = upsert_in_section(SAMPLE, "env:esp32c3", "board_build.partitions", "custom.csv");
        // esp32c3 now has the key
        assert_eq!(get_in_section(&updated, "env:esp32c3", "board_build.partitions").as_deref(), Some("custom.csv"));
        // esp32s3 still has its original
        assert_eq!(get_in_section(&updated, "env:esp32s3", "board_build.partitions").as_deref(), Some("partitions.csv"));
    }

    #[test]
    fn upsert_preserves_trailing_newline() {
        let with_nl = "[env:x]\nboard = y\n";
        assert!(upsert_in_section(with_nl, "env:x", "board_build.partitions", "p.csv").ends_with('\n'));
    }
}
