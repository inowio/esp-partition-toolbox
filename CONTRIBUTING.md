# Contributing to ESP Partition Toolbox

Thanks for helping us improve the toolbox! This guide keeps contribution steps short and consistent.

## Quick Start

```bash
git clone https://github.com/inowio/esp-partition-toolbox.git
cd esp-partition-toolbox
npm install
npm run tauri dev
```

Prerequisites: Node.js 18+, Rust stable toolchain, Git, and a code editor (VS Code + Tauri, rust-analyzer recommended). Building Tauri also needs the platform toolchain — VS Build Tools on Windows, Xcode CLT on macOS, `build-essential` + WebKitGTK on Linux.

## Workflow

1. Fork the repo and branch off `main` using `feature/<topic>` or `fix/<topic>`.
2. Follow [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `docs:`…).
3. Keep pull requests focused, include tests/docs, and add screenshots for UI work.
4. Open the PR against `main`, reference related issues, and await review.

## Coding Standards

- React + TypeScript only; prefer `export default function Component()` style.
- Rust code must pass `cargo fmt` and `cargo clippy` with warnings treated as errors.
- Avoid duplicated logic, keep functions small, and return explicit errors.
- Update docs or help content whenever behavior changes.

## Testing & Checks

```bash
npm run test:run                                  # Frontend tests (Vitest)
cargo test --manifest-path src-tauri/Cargo.toml   # Rust tests
cargo fmt --manifest-path src-tauri/Cargo.toml    # Rust formatting
cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings
```

Please add or update tests alongside new features or bug fixes. See [TESTING.md](TESTING.md) for the coverage summary and conventions.

## Reporting Issues & Requests

- **Bug reports**: include OS, app version, Node/Rust versions, the ESP-IDF project layout if relevant, reproduction steps, expected vs actual results, and logs/screenshots if possible.
- **Feature ideas**: describe the use case, desired outcome, and any alternatives considered.

## Releasing

Maintainers cut releases via `npm run release -- X.Y.Z` followed by pushing
the `vX.Y.Z` tag. The full runbook — one-time keypair setup, CI secrets,
publishing the draft release, failure recovery, and pre-release tags — is
in [docs/RELEASING.md](docs/RELEASING.md).

## Community Expectations

Be respectful, inclusive, and helpful. Use GitHub Issues for bugs/features and Discussions for questions or ideas.

---

Thank you for contributing! 🚀
