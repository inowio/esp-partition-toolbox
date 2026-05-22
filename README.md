# ESP Partition Toolbox

A desktop GUI for managing ESP-IDF partition tables. Load an ESP-IDF project folder, visually edit partition layouts, validate constraints, and save back to CSV — all without touching a text editor.

## Features

- **Project loading** — auto-discovers `sdkconfig.defaults` / `sdkconfig`, honors existing `CONFIG_PARTITION_TABLE_CUSTOM_FILENAME`
- **Visual partition map** — proportional color-coded bar chart of flash usage
- **Inline editing** — name, type/subtype dropdowns, size (hex / K / M), encrypted flag
- **Real-time validation** — alignment checks, boundary overflow, duplicate detection
- **KPI dashboard** — total / allocated / free space at a glance
- **Comments** — preserved as `#` lines in the CSV header
- **Save / Refresh / Reset** — full round-trip with snapshot-based undo

## Tech Stack

- **Frontend**: React 19, TypeScript, Tailwind CSS v4, react-icons
- **Backend**: Tauri 2 (Rust)
- **Build**: Vite 7

## Getting Started

```bash
# Install frontend dependencies
npm install

# Run in development mode (opens Tauri window with hot-reload)
npx tauri dev

# Build for production
npx tauri build
```

## Recommended IDE Setup

- [VS Code](https://code.visualstudio.com/) + [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)

## Testing

```bash
# Run frontend tests
npx vitest run

# Run Rust tests
cargo test --manifest-path src-tauri/Cargo.toml
```
