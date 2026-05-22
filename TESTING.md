# Testing

## Coverage Summary
- **Frontend (Vitest + React Testing Library + jsdom)** — 234 tests
  - Utilities: size parsing/formatting, CSV parse/serialize, layout calculation, ESP-IDF partition rules, full round-trip (`utils/partition.ts`).
  - Constants: partition type/subtype option resolution (`constants/partitionOptions.ts`).
  - Components: all 11 presentational components (navbar, KPI cards, error card, visual map, partition table, modals, toasts, project header, comments, partition info).
  - State hook: `usePartitionProject` — load/save/close/reset flows, validation gating, snapshots, toasts (Tauri APIs mocked).
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
- Add new React tests under `src/**/*.test.ts(x)`.
- Tauri APIs (`@tauri-apps/api/core`, `@tauri-apps/plugin-dialog`) are mocked via `vi.mock` in hook tests — see `src/hooks/usePartitionProject.test.tsx`.
- Add Rust unit tests inside the `#[cfg(test)]` block in `src-tauri/src/lib.rs`.
- Filesystem-backed Rust tests use a unique `std::env::temp_dir()` subfolder and clean up afterward.
