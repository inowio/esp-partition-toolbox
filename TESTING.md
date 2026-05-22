# Testing

## Coverage Summary
- **Frontend (Vitest + React Testing Library + jsdom)** — 349 tests
  - Utilities: size parsing/formatting, CSV parse/serialize, layout calculation, pinned offsets, ESP-IDF partition rules (flags, custom types), full round-trip (`utils/partition.ts`).
  - Constants: partition type/subtype option resolution (`constants/partitionOptions.ts`).
  - Components: every presentational component — navbar, KPI cards, error card, visual map, partition table, the modal dialogs (delete, close, about, help, update), the preview / sdkconfig-entry / comments cards, toasts, project header, and the editable-field context menu.
  - State hook: `usePartitionProject` — load/save/close/reset flows, validation gating, snapshots, toasts (Tauri APIs mocked).
  - Updater: `api/updater.ts` — check / install-and-relaunch flows with the Tauri updater & process plugins mocked.
  - Release tooling: `scripts/bump-version.mjs` — semver parsing/compare, version rewriting across the manifests, changelog reshaping, and git-state guards (against a temporary repo).
- **Backend (Rust unit tests)** — 31 tests
  - Pure helpers: numeric alignment, hex formatting, sdkconfig key extraction, partition-block normalization.
  - Filesystem helpers: project-root validation, sdkconfig discovery/selection, partition-block writing.
  - Command integration: `load_esp_project` and `save_project_state` against temporary project folders.

## Commands

### Frontend
```bash
npm run test:run      # single run
npm test              # watch mode
```

### Backend
```bash
# from src-tauri
cargo test
```

## Tips
- Frontend tests run in **jsdom** with `@testing-library/jest-dom` matchers (`src/setupTests.ts`).
- Add new React tests under `src/**/*.test.ts(x)`; release-script tests live under `scripts/**/*.test.mjs` (both globs are wired into `vitest.config.ts`).
- Tauri APIs (`@tauri-apps/api/core`, `@tauri-apps/plugin-dialog`, `@tauri-apps/plugin-updater`, `@tauri-apps/plugin-process`, `@tauri-apps/plugin-clipboard-manager`) are mocked via `vi.mock` — see `src/hooks/usePartitionProject.test.tsx`, `src/api/updater.test.ts`, and `src/components/EditableContextMenu.test.tsx`.
- Add Rust unit tests inside the `#[cfg(test)]` block in `src-tauri/src/lib.rs`.
- Filesystem-backed Rust tests use a unique `std::env::temp_dir()` subfolder and clean up afterward.
