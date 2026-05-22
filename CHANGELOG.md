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
- Visual partition map: a proportional, color-coded bar of flash usage with a
  legend that names the reserved, partition, and free regions.
- Inline partition editing: name, type/subtype dropdowns, size (hex / K / M,
  a drag slider, and fill-to-max), and the `encrypted` and `readonly` flags.
- Advanced mode: editable/pinnable partition offsets and custom numeric
  partition types/subtypes (`0x40`–`0xFE`), behind a per-table toggle.
- Real-time validation: 4 KB / 64 KB alignment, flash-boundary overflow,
  pinned-offset overlaps, duplicate names, and ESP-IDF partition rules
  (including the read-only flag's data-only constraint).
- KPI dashboard for total / allocated / free flash space.
- Partition Preview card with a live, read-only view of the exact partition
  CSV, alongside an "Entry for sdkconfig" card — both with one-click copy.
- Comment preservation as `#` lines in the partition CSV header.
- Save / Refresh / Reset round-trip with snapshot-based undo (Reset also
  restores the default layout when no project is loaded), plus optional
  `sdkconfig` partition-entry sync.
- Custom right-click menu (cut / copy / paste / delete / select all) on
  editable fields, backed by the Tauri clipboard plugin so the WebView shows
  no permission prompts.
- About and Help dialogs, opened from the navbar — Help is a tabbed reference
  (getting started, partition types, flags & encryption, key concepts).
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
