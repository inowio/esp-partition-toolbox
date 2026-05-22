# Changelog

All notable changes to this project are tracked here following [Keep a Changelog](https://keepachangelog.com/en/1.0.0/) and [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

_No changes yet._

## [0.1.0] - 2026-05-22

### Added
- Initial public release of ESP Partition Toolbox.
- Project loading: auto-discovers `sdkconfig.defaults` and
  `sdkconfig.defaults.*` variants and honors an existing
  `CONFIG_PARTITION_TABLE_CUSTOM_FILENAME`.
- Visual partition map: proportional, color-coded bar chart of flash usage.
- Inline partition editing: name, type/subtype dropdowns, size (hex / K / M),
  and the encrypted flag.
- Real-time validation: 4 KB alignment checks, flash-boundary overflow, and
  duplicate name detection, with ESP-IDF partition rules.
- KPI dashboard for total / allocated / free flash space.
- Comment preservation as `#` lines in the partition CSV header.
- Save / Refresh / Reset round-trip with snapshot-based undo, plus optional
  `sdkconfig` partition-entry sync.
- About dialog — version, feature summary, license, source links, and
  company information — opened from the navbar.
- In-app auto-updater: a silent check on startup that prompts when a newer
  release is available, plus a manual "Check for updates" button in the
  About dialog.
- GitHub Actions release workflow that builds Windows, Linux, and macOS
  installers on every `v*` tag and publishes them as a draft release with
  signed update artifacts.
- `npm run release -- X.Y.Z` bump script that syncs the version across
  `package.json`, `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml`, and
  `src-tauri/Cargo.lock`, and reshapes `CHANGELOG.md` into a dated section.
- `docs/RELEASING.md` maintainer runbook and `CONTRIBUTING.md` contributor
  guide.
