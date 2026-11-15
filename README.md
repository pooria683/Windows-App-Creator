# WinForge

**Scaffold, develop, build and package Windows desktop apps — from macOS or Linux.**

WinForge generates standalone [Electron](https://www.electronjs.org/) or
[Tauri](https://tauri.app/) projects in TypeScript, wires up secure defaults,
configures real Windows installers (NSIS `.exe`, portable `.exe`, optional
`.msi`), and generates a GitHub Actions workflow that builds **Windows, macOS
and Linux** artifacts on native runners.

> **Honesty first:** installers built locally on macOS/Linux are **unsigned**
> and **untested** — they are not production-ready until you sign them and
> install them on the target OS. WinForge keeps code signing **optional and
> disabled by default**, never hardcodes secrets, and tells you when a target
> can only be produced in CI instead of pretending otherwise.

---

## Contents

- [Quick start](#quick-start)
- [Requirements](#requirements)
- [Commands](#commands)
- [What you get](#what-you-get)
- [Windows builds from macOS/Linux](#windows-builds-from-macoslinux)
- [Code signing](#code-signing)
- [Verified vs. untested](#verified-vs-untested)
- [Repository layout](#repository-layout)
- [Development](#development)
- [FAQ](#faq)

---

## Quick start

### With npm (published package)

```bash
# macOS or Linux
npm install -g @winforge/cli

winforge doctor                                  # check your environment
winforge create my-app --template electron        # interactive by default
cd my-app
npm run dev                                      # hot reload
winforge build --target windows                  # NSIS + portable .exe
winforge ci --release                            # 3-OS workflow for GitHub
```

### From a clone of this repo (no publish required)

```bash
git clone https://github.com/pooria683/Windows-App-Creator.git
cd Windows-App-Creator

npm install
npm run build                                    # CLI + templates + web UI
npm test                                         # unit tests

# Use the local CLI binary
node packages/cli/dist/index.js doctor
node packages/cli/dist/index.js create /tmp/my-app \
  --template electron --ui react --pm npm --non-interactive
cd /tmp/my-app && npm install && npm run dev

# Optional: global link so `winforge` works everywhere
npm link packages/cli
```

### Web UI (command builder)

```bash
npm run dev:web        # http://localhost:4173
```

Pick a template, UI framework and package manager; the page validates your
input and prints the exact `winforge create` command to copy. It does not
build or download anything.

---

## Requirements

| Tool                    | Version    | Needed for                                                                             |
| ----------------------- | ---------- | -------------------------------------------------------------------------------------- |
| Node.js                 | ≥ 20 (LTS) | everything                                                                             |
| npm / pnpm / yarn / bun | any recent | dependency install                                                                     |
| git                     | any        | version control, CI                                                                    |
| Rust (rustup)           | stable     | **Tauri projects only**                                                                |
| Wine                    | recent     | Electron → Windows builds from macOS/Linux (optional but recommended)                  |
| WebKitGTK dev libs      | 4.1        | **Tauri on Linux**: `libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev patchelf` |

`winforge doctor` checks all of this and prints install instructions for
anything missing.

### Install signing/build helpers

```bash
# macOS — Wine for Electron Windows cross-builds
brew install --cask wine-stable

# macOS — Rust for Tauri
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Debian/Ubuntu — Wine + Tauri Linux deps + packaging tools
sudo apt update
sudo apt install wine wine64 rpm \
  libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev patchelf

# Fedora — equivalents
sudo dnf install wine rpm-build webkit2gtk4.1-devel libappindicator-gtk3-devel \
  librsvg2-devel patchelf
```

---

## Commands

| Command                                                       | What it does                                                                    |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `winforge create <name>`                                      | Scaffold a new Electron or Tauri project (interactive prompts, validated input) |
| `winforge dev`                                                | Start development with hot reload (`vite` + Electron, or `tauri dev`)           |
| `winforge build --target windows\|macos\|linux\|all`          | Build for a platform; explains which targets need CI                            |
| `winforge package --format exe\|msi\|dmg\|appimage\|deb\|rpm` | Produce one installer format                                                    |
| `winforge ci`                                                 | Generate `.github/workflows/build.yml` for all three OSes                       |
| `winforge doctor`                                             | Detect missing dependencies, print fixes and a capability matrix                |

Full flag reference: [`docs/cli-reference.md`](docs/cli-reference.md).

### Interactive setup prompts

`winforge create` asks for **app name**, **display name**, **framework**
(Electron / Tauri), **UI framework** (React / Vue / Svelte / plain HTML+CSS+JS),
**package manager** (npm / pnpm / yarn / bun), **package identifier**
(reverse-DNS), **semver version**, **author/publisher** and **description** —
all validated before a file is written. Pass `--non-interactive` plus flags for
scripted use.

---

## What you get

```
my-app/
├── README.md                  # setup, dev, build, signing, release
├── package.json               # names, version, scripts, builder config
├── winforge.config.json       # CLI config (signing disabled by default)
├── .gitignore  .prettierrc  eslint.config.js
├── assets/icon.{ico,icns,png} # real placeholder icons, replace before release
├── tests/                     # Vitest smoke tests
│
├── Electron template                     ├── Tauri template
│   src/main/main.ts      secure window    │   src-tauri/src/main.rs
│   src/main/preload.cts  contextBridge    │   src-tauri/src/commands.rs
│   src/renderer/         sandboxed React  │   src-tauri/tauri.conf.json
│   src/shared/types.ts   IPC types        │   src-tauri/capabilities/
└── electron-builder NSIS/portable/MSI     └── NSIS + WiX MSI bundle config
```

Both templates ship: an app icon, product name, version, publisher,
description, Windows file metadata (company/product/version via
`electron-builder` / `tauri.conf.json`), strict TypeScript, ESLint, Prettier,
and tests.

### Security defaults

- `contextIsolation: true`, `sandbox: true`, **`nodeIntegration: false`**
- Preload exposes exactly two IPC calls through `contextBridge` — never
  `ipcRenderer`, `fs` or `shell`
- IPC arguments validated in the main process; only `https://` URLs can be
  opened externally
- Strict CSP in the packaged renderer; dev-only CSP relaxation for Vite HMR
- Tauri: a single registered command, minimal `capabilities/default.json`,
  no filesystem/shell permissions
- No secrets anywhere in templates or workflows — environment variable _names_
  only

---

## Windows builds from macOS/Linux

| Your host        | Electron → Windows                                | Tauri → Windows                              |
| ---------------- | ------------------------------------------------- | -------------------------------------------- |
| macOS            | ✅ locally via electron-builder + Wine (unsigned) | ❌ needs Windows (Rust + MSVC + Windows SDK) |
| Linux            | ✅ locally via electron-builder + Wine (unsigned) | ❌ needs Windows                             |
| `windows-latest` | ✅ signed or unsigned                             | ✅ signed or unsigned                        |

```bash
# Electron, locally — produces installer + portable exe in release/
winforge build --target windows
ls release/
# MyApp-0.1.0-x64.exe           NSIS installer
# MyApp-0.1.0-x64-portable.exe  portable build

# Tauri on macOS/Linux — honest refusal plus the fix
winforge build --target windows
# ⚠ Cannot build "windows" locally on macos: Tauri/Rust cannot cross-compile…
#   → GitHub Actions (windows-latest) required
#   Generate a workflow with: winforge ci
```

`winforge build --target all` builds every target your host supports and prints
what remains for CI. Full explanation, including why the two frameworks differ:
[`docs/windows-builds.md`](docs/windows-builds.md).

### Generated workflow

```bash
winforge ci --release
git add .github/workflows/build.yml && git commit -m "ci: build desktop apps" && git push
```

| Runner           | Artifacts                                     |
| ---------------- | --------------------------------------------- |
| `windows-latest` | NSIS `.exe`, portable `.exe`, optional `.msi` |
| `macos-latest`   | `.dmg` (+ `.zip`)                             |
| `ubuntu-latest`  | `.AppImage`, `.deb`, `.rpm`                   |

Every job uploads artifacts with `actions/upload-artifact@v4`; the Electron jobs
also publish `SHA256SUMS.txt`. On `v*` tags, `--release` adds a job that opens a
**draft** GitHub Release so a human reviews the installers before users see them.

```bash
git tag v0.1.0 && git push --tags
```

---

## Code signing

Signing is **optional** and **off by default**. Generated projects contain
`"signing": { "windows": {"enabled": false}, … }`. Unsigned installers trigger
Windows SmartScreen and macOS Gatekeeper — treat them as test builds.

| Platform | Mechanism                                  | Secrets (CI)                                                                                       |
| -------- | ------------------------------------------ | -------------------------------------------------------------------------------------------------- |
| Windows  | Authenticode (signtool / electron-builder) | `WIN_CSC_LINK`, `WIN_CSC_KEY_PASSWORD`                                                             |
| macOS    | Developer ID + notarization                | `MAC_CSC_LINK`, `MAC_CSC_KEY_PASSWORD`, `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID` |
| Linux    | GPG detached signatures over packages      | `GPG_PRIVATE_KEY` (import inside the release job only)                                             |

```bash
winforge ci --signing --force      # references the secrets above; still no values in git
```

Step-by-step, including verification commands:
[`docs/signing.md`](docs/signing.md).

---

## Repository layout

```
Windows-App-Creator/
├── packages/
│   ├── cli/                 # @winforge/cli — the `winforge` binary (TypeScript, ESM)
│   │   ├── src/commands/    # create, dev, build, package, ci, doctor
│   │   ├── src/lib/         # validate, detect, config, scaffold, runner, prompts, logger
│   │   └── src/__tests__/   # Vitest: validation, detection, scaffolding, config, CI
│   ├── templates/           # @winforge/templates
│   │   ├── electron-react-ts/
│   │   ├── tauri-react-ts/
│   │   └── github-actions/build.yml
│   └── web-ui/              # @winforge/web-ui — React + Vite command builder
├── examples/
│   ├── electron-hello/      # generated by `npm run create:example`
│   └── tauri-hello/
├── docs/
│   ├── architecture.md      # diagram + design decisions
│   ├── windows-builds.md    # how Windows installers are produced
│   ├── signing.md           # Authenticode, notarization, GPG
│   ├── security.md          # Electron/Tauri hardening, input validation
│   ├── verification.md      # what was actually tested vs. environment limits
│   └── cli-reference.md     # every command and flag
├── schema/
│   └── winforge.config.schema.json
└── .github/workflows/       # monorepo CI + CLI publish
```

Architecture diagram and rationale: [`docs/architecture.md`](docs/architecture.md).

## Verified vs. untested

Everything in this repo is typechecked, linted and covered by **73 automated
tests** (CLI unit + binary integration + interactive prompt flows + web UI).
Both example apps install, typecheck and bundle; all four UI frameworks build.

What is **not** verified is anything that needs Electron/Windows tooling this
sandbox cannot download — producing the actual `.exe`, `.msi`, `.dmg`, signing
them, and running the installer on Windows. Those steps are documented and
wired into CI, but you must run them and test the result. Details and
reproduction commands: [`docs/verification.md`](docs/verification.md).

---

## Development

```bash
npm install
npm run build          # CLI (tsc + template copy) and web UI
npm test               # Vitest across workspaces
npm run lint
npm run typecheck
npm run format
npm run doctor         # local capability report
npm run create:example # regenerate examples/* from the CLI
```

| Script                                  | Purpose                                                                         |
| --------------------------------------- | ------------------------------------------------------------------------------- |
| `npm run build`                         | Compile CLI, copy templates into the CLI package, build web UI                  |
| `npm test`                              | Unit tests: validation, host detection, scaffolding, config, workflow rendering |
| `npm run lint` / `typecheck` / `format` | Quality gates                                                                   |
| `npm run dev:web`                       | Web UI at http://localhost:4173                                                 |
| `npm run create:example`                | Regenerate both example projects                                                |

Commit conventions are conventional-commits style (`feat:`, `fix:`, `docs:`,
`test:`, `chore:`); releases use `npm version <patch|minor|major>` then
`git push --tags` — which also triggers the release workflow for the CLI.

---

## FAQ

**Does WinForge make my app production-ready automatically?**
No. It gives you a correct, secure, typed project and real installer targets.
Production readiness still needs signing, testing on the target OS, and a
release process — the CLI says so at the end of every build.

**Why can't Tauri build Windows on my Mac?**
Tauri compiles Rust. A Windows binary needs the MSVC toolchain and Windows SDK,
which only exist on Windows. Tauri's own docs say the same. Use
`windows-latest` (generated for you by `winforge ci`).

**Does Electron really build Windows installers on Linux?**
Yes — electron-builder runs NSIS through Wine. The result is unsigned. `.msi`
builds via WiX on Wine are unreliable; use CI for those.

**Why is `nodeIntegration` off?**
Because enabling it hands full Node.js access to any script in your renderer —
the standard path to remote-code-execution bugs. WinForge uses a narrow
`contextBridge` API instead. See the templates' `preload.cts` / `commands.rs`.

**Can I use Vue, Svelte or vanilla JS?**
Yes. `--ui vue|svelte|vanilla` swaps the renderer entry while keeping the same
secure shell and build config; the template README explains the wiring.

**Does `winforge ci` overwrite my workflow?**
Only with `--force`. It refuses otherwise, so it is safe to re-run.

**Is anything sent anywhere?**
No. The CLI is local-only; the web UI builds a string and copies it to your
clipboard.

---

## License

MIT. Templates and generated projects are yours to use, modify and ship.
