# ESP Partition Toolbox

[![Latest release](https://img.shields.io/github/v/release/inowio/esp-partition-toolbox?include_prereleases&sort=semver)](https://github.com/inowio/esp-partition-toolbox/releases/latest)
[![Release workflow](https://github.com/inowio/esp-partition-toolbox/actions/workflows/release.yml/badge.svg)](https://github.com/inowio/esp-partition-toolbox/actions/workflows/release.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-emerald.svg)](LICENSE)

A desktop GUI for managing ESP-IDF partition tables. Load an ESP-IDF project folder, visually edit the partition layout, validate ESP-IDF constraints in real time, and save back to CSV — all without hand-editing a text file or guessing offsets.

![ESP Partition Toolbox](public/logo.svg)

## Highlights

- **Project loading** — auto-discovers `sdkconfig.defaults` / `sdkconfig.defaults.*` and honors an existing `CONFIG_PARTITION_TABLE_CUSTOM_FILENAME`
- **Visual partition map** — proportional, color-coded bar of flash usage with a labelled legend
- **Inline editing** — name, type/subtype dropdowns, size (hex / K / M, slider, fill), and the `encrypted` and `readonly` flags
- **Advanced mode** — pin partition offsets to fixed addresses and define custom numeric partition types
- **Real-time validation** — 4 KB / 64 KB alignment, flash-boundary overflow, offset overlaps, duplicate detection, and ESP-IDF partition rules
- **Partition Preview** — a live, copyable view of the exact CSV that gets written, alongside the sdkconfig entries
- **KPI dashboard** — total / allocated / free space at a glance
- **Comments** — preserved as `#` lines in the partition CSV header
- **Save / Refresh / Reset** — full round-trip with snapshot-based undo and optional `sdkconfig` sync
- **In-app help & updater** — a tabbed Help reference, a custom right-click menu on every field, and a silent auto-update check (with a manual recheck in the About dialog)
- Ships as a native desktop app for Windows, macOS, and Linux

## Install

Pre-built installers for every release live on the
**[Releases page](https://github.com/inowio/esp-partition-toolbox/releases/latest)**.
Pick the right one for your OS:

| OS      | Recommended installer | Auto-update | Notes                                     |
| ------- | --------------------- | ----------- | ----------------------------------------- |
| Windows | `*-setup.exe` (NSIS)  | Yes         | Use this for personal/desktop installs.   |
| Windows | `*.msi`               | No          | Manual re-install only; for MDM/IT use.   |
| macOS   | `*.dmg`               | Yes         | Universal binary (Intel + Apple Silicon). |
| Linux   | `*.AppImage`          | Yes         | Mark executable, then run.                |
| Linux   | `*.deb` / `*.rpm`     | No          | Manual re-install only.                   |

> **First-launch warning.** The binary is currently unsigned at the OS level,
> so the first time you run it Windows SmartScreen will show "Windows
> protected your PC" — click **More info → Run anyway**. macOS Gatekeeper
> will say the app cannot be opened — right-click the app and choose
> **Open**, then confirm. After this one-time approval, auto-updates inherit
> the trust and install silently.

### How updates work

Every release after the auto-update feature shipped checks
`https://github.com/inowio/esp-partition-toolbox/releases/latest` on startup.
If a newer version exists, the app prompts you to install — you can also
trigger the check manually from the **About** dialog (the ⓘ icon in the
navbar). Updates are minisign-signed by the updater key, so a tampered
download is rejected.

## Getting Started

### Requirements

- Node.js 18+
- Rust (stable) + target-specific build tools (VS Build Tools on Windows, Xcode CLT on macOS, `build-essential` + WebKitGTK on Linux)

You do **not** need ESP-IDF installed to run the app — it only reads and writes the project's partition CSV and `sdkconfig` files.

### Quick Start

```bash
git clone https://github.com/inowio/esp-partition-toolbox.git
cd esp-partition-toolbox
npm install
npm run tauri dev
```

### Production Build

```bash
npm run tauri build
# Bundles land in src-tauri/target/release/bundle
```

## Development

```bash
npm run dev         # Vite frontend only
npm run tauri dev   # Full-stack dev (frontend + Rust)
npm run build       # Type-check + production frontend build
```

## Unit Testing

```bash
npm run test:run                                  # Frontend tests (Vitest)
cargo test --manifest-path src-tauri/Cargo.toml   # Rust tests
```

See [TESTING.md](TESTING.md) for the coverage summary and conventions.

## Project Structure

```
esp-partition-toolbox/
├── src/             # React + TypeScript UI
│   ├── api/         # Updater + external-link helpers
│   ├── components/  # Presentational components
│   ├── hooks/       # Project state hook
│   └── utils/       # Partition parsing, layout, validation
├── src-tauri/       # Rust backend, Tauri config, icons
├── scripts/         # Release tooling (version bump)
├── docs/            # Maintainer documentation
└── public/          # Static assets
```

## Recommended IDE Setup

- [VS Code](https://code.visualstudio.com/) + [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)

## Troubleshooting

- **Project won't load** — the folder must be an ESP-IDF project: it needs a `CMakeLists.txt` and at least one `sdkconfig.defaults` (or `sdkconfig.defaults.*`) file.
- **Partition file missing** — if no partition CSV exists yet, the app generates a sensible default layout in memory; it is written to disk only when you save.
- **Validation errors block saving** — fix the blocking errors listed in the validation panel; warnings do not block a save.
- **Build failures** — reinstall dependencies (`npm ci`), update the Rust toolchain, and ensure the platform build tools listed under Requirements are present.

## Contributing

Please read [CONTRIBUTING.md](CONTRIBUTING.md) before opening an issue or pull request. Conventional commits, automated tests, and linted code help us triage quickly.

Maintainers cutting a release: see [docs/RELEASING.md](docs/RELEASING.md).

## License

Released under the [MIT License](LICENSE).

## Support & Contact

- Issues: <https://github.com/inowio/esp-partition-toolbox/issues>
- Discussions: <https://github.com/inowio/esp-partition-toolbox/discussions>
- Email: <support@inowio.in>

---

**Inowio Technologies LLP**
– From Bits to Machines.
[https://inowio.in](https://inowio.in)
