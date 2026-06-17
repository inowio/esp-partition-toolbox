# Changelog

All notable changes to this project are tracked here following [Keep a Changelog](https://keepachangelog.com/en/1.0.0/) and [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **Multi-platform project support.** Project loading now auto-detects
  **ESP-IDF**, **PlatformIO**, and **Arduino** projects and reads the existing
  partition table for each.
- **PlatformIO:** parses `platformio.ini`, detects the MCU and flash size,
  lists the project's `[env:…]` environments, and — with Config sync on —
  writes `board_build.partitions` into the chosen environment(s) without
  duplicating entries.
- **Arduino:** detects a sketch folder, always writes `partitions.csv` into it,
  and — when a `sketch.yaml` exists — sets `PartitionScheme=custom` on its
  FQBN(s) (never creating `sketch.yaml`). Bare sketches get in-app guidance
  (Tools → Partition Scheme → "Custom" + a clean rebuild).
- **MCU selector** in the toolbar, detected from `CONFIG_IDF_TARGET` (ESP-IDF),
  the `board` / `board_build.mcu` (PlatformIO), or the FQBN (Arduino), and
  editable for projects that don't declare it.
- **Flash-size inference.** When the platform config declares no flash size but
  an existing partition table is present, the smallest standard flash size that
  fits the table is selected automatically (shown via a notice), instead of
  defaulting to the smallest size and flagging false overflow errors.
- **Platform-aware config preview** — the config snippet matches the active
  platform (`CONFIG_PARTITION_TABLE_*` for ESP-IDF, `board_build.partitions`
  for PlatformIO, sketch guidance for Arduino).

### Changed
- **Redesigned toolbar** into clearer zones: a project-actions row
  (Load / Save / Close / Reset) and a **Target & Output** card
  (Platform · MCU · Flash · partition file · Config sync). The **Partition
  Start** offset moved into the Partition Table card.
- **Config sync is now platform-aware:** ESP-IDF updates `sdkconfig.defaults`,
  PlatformIO updates the selected environment, and Arduino updates `sketch.yaml`
  when present. The partition CSV is always written; config edits are opt-in.
- **KPI dashboard:** Allocated and Free are now shown as a percentage of
  *usable* flash (excluding the reserved bootloader / partition-table region).
- Help & README updated to cover all three platforms.

### Fixed
- **First partition placement.** The first partition now starts immediately
  after the partition table (e.g. `0x9000` for a `0x8000` table), matching
  ESP-IDF/esptool, instead of being forced to `0x10000`. A valid, tight layout
  (e.g. a 4 MB OTA table) is no longer inflated past its flash boundary on load.
- **Filename safety.** Partition filenames are sanitized before any write —
  rejecting path separators, parent traversal, absolute paths, Windows
  drive-relative paths, and non-`.csv` names.
- **Partition Start offset is persisted on Save** (the preview and the saved
  file could previously disagree).
- **Loading a project no longer writes config files** — config is edited only
  on an explicit Save with Config sync enabled.
- Unsaved-changes state now clears correctly after a successful save.
- **ESP-IDF:** enabling a custom partition table now also turns off the
  conflicting built-in options (`SINGLE_APP` / `SINGLE_APP_LARGE` / `TWO_OTA`)
  so the custom table isn't ignored by the build.

## [0.2.0] - 2026-06-04

### Added
- Editable **Partition Start** offset in the Project Header — freeform input
  with a built-in dropdown of common values (`0x8000` default, `0x9000`/
  `0xA000` for extra bootloader headroom, `0xC000`/`0xE000` for larger
  bootloaders, `0x10000` for secure boot / flash encryption, `0x20000` for
  advanced custom layouts), inline validity styling, and explicit validation-
  panel errors for unparseable or misaligned values.
- Flash-size auto-detection: project loading reads `CONFIG_ESPTOOLPY_FLASHSIZE`
  from sdkconfig and pre-selects the matching value in the Flash Size
  dropdown.

### Changed
- Help & Reference: Getting Started (Step 1 + Step 5) and Key Concepts updated
  to reflect the new partition-offset presets, flash-size auto-detection, and
  validation messages.

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
