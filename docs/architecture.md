# WinForge architecture

WinForge is a small TypeScript monorepo that turns "I'm on macOS/Linux and I
need a Windows desktop app" into three commands: `create`, `dev`, `build`.

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                                 WinForge CLI                                 │
│                         packages/cli  (@winforge/cli)                        │
│                                                                              │
│   index.ts ──▶ cli.ts ──▶ commands/                                          │
│                           ├── create.ts   scaffold + install                 │
│                           ├── dev.ts      run project dev script (HMR)       │
│                           ├── build.ts    --target windows|macos|linux|all   │
│                           ├── package.ts  --format exe|msi|dmg|appimage|…    │
│                           ├── ci.ts       render GitHub Actions workflow     │
│                           └── doctor.ts   host/dep/capability report         │
│                                    │                                         │
│                       lib/ ────────┤                                         │
│                       ├── validate.ts   app name, reverse-DNS id, semver     │
│                       ├── detect.ts     host OS/arch + capability matrix     │
│                       ├── config.ts     winforge.config.json load/defaults   │
│                       ├── scaffold.ts   copy template + {{TOKEN}} render     │
│                       ├── renderers.ts  Vue/Svelte/vanilla overlay patches   │
│                       ├── runner.ts     npm/pnpm/yarn/bun command mapping    │
│                       ├── prompts.ts    interactive setup                    │
│                       └── logger.ts     chalk output                         │
└───────────────┬──────────────────────────────┬───────────────────────────────┘
                │ copies + renders             │ prints a create command
                ▼                              ▼
┌───────────────────────────────┐   ┌──────────────────────────────────────────┐
│ packages/templates            │   │ packages/web-ui (React + Vite)           │
│ ├── electron-react-ts         │   │ • validates name / package id            │
│ ├── tauri-react-ts            │   │ • builds the exact CLI command to copy   │
│ ├── renderers/{vue,svelte,    │   │ • target matrix: local vs. CI            │
│ │   vanilla}  (UI overlays)   │   └──────────────────────────────────────────┘
│ └── github-actions/build.yml  │
└───────────────┬───────────────┘
                │ scaffolded project (own git repo, own dependencies)
                │ + renderer overlay when UI != React
                ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                         Generated application project                        │
│                                                                              │
│  Electron template                        Tauri template                     │
│  ├── src/main/main.ts   (secure window)   ├── src-tauri/src/main.rs          │
│  ├── src/main/preload.cts (contextBridge) ├── src-tauri/src/commands.rs      │
│  ├── src/renderer/      (React, sandbox)  ├── src/renderer/ (React, IPC only)│
│  ├── assets/icon.{ico,icns,png}           ├── src-tauri/icons/*              │
│  ├── electron-builder config              ├── tauri.conf.json (NSIS + MSI)   │
│  └── winforge.config.json                 └── winforge.config.json           │
└───────────────┬──────────────────────────────────────────────────────────────┘
                │ `winforge build` / `winforge package` / `winforge ci`
                ▼
┌────────────────────┐   ┌────────────────────┐   ┌────────────────────────────┐
│ Local machine      │   │ Local machine      │   │ GitHub Actions             │
│ macOS / Linux      │   │ (native only)      │   │ windows-latest  → .exe .msi│
│  Electron Windows  │   │ macOS → .dmg       │   │ macos-latest    → .dmg     │
│  (Wine, unsigned)  │   │ Linux → .AppImage  │   │ ubuntu-latest   → .AppImage│
│                    │   │         .deb .rpm  │   │                   .deb .rpm│
└────────────────────┘   └────────────────────┘   └────────────────────────────┘
```

## Design decisions

**Templates are plain directories with `{{TOKEN}}` placeholders.** No template
engine, no `eval`, no code generation from arbitrary input. `scaffold.ts` walks
the tree, substitutes a fixed, auditable token set (`APP_NAME`, `PRODUCT_NAME`,
`PACKAGE_ID`, `VERSION`, …) in text files, and byte-copies binaries (icons).
That makes scaffolding idempotent and trivially testable — see
`packages/cli/src/__tests__/scaffold.test.ts`.

**Non-React UIs are overlays, not stubs.** Choosing Vue, Svelte or vanilla
copies a complete renderer entry from `packages/templates/renderers/<ui>/files`
and patches `package.json`, `vite.config.ts`, `tsconfig.json` and `index.html`
(`lib/renderers.ts`). React packages are removed, the framework's dependencies
and Vite plugin are added, and the main process/preload/IPC layer stays
identical — so the security model does not change with the UI framework. Each
variant was installed and built during development (see
[`verification.md`](verification.md)).

**The generated project is standalone.** After `create` finishes, the CLI is
only needed for convenience commands. Everything runs through
`package.json` scripts (`build:windows`, `package:msi`, …), so a developer on a
Windows machine — or a CI runner — can build without the CLI installed.

**`winforge.config.json` is the source of truth for the CLI.** It records
app name, package id, version, template, UI, package manager and the signing
block. Signing is written as `{ enabled: false }` for all three platforms and
stays disabled until a developer deliberately edits it.

**Capabilities are computed, not assumed.** `detect.ts` returns a three-row
matrix (Windows / macOS / Linux) for the current host and template:
whether it can be built locally, by what method, and what the caveats are.
`build.ts`, `package.ts` and `doctor.ts` all read that single matrix, so the
CLI cannot claim a target is buildable when it isn't.

**Security defaults are locked in the templates.** The Electron template uses
`contextIsolation: true`, `sandbox: true`, `nodeIntegration: false`, a
CommonJS preload (`preload.cts`) that exposes exactly two IPC calls through
`contextBridge`, validated IPC arguments in the main process, a strict CSP in
the packaged renderer, and a `setWindowOpenHandler` that refuses in-app
navigation and only opens `https://` URLs externally. The Tauri template ships
a single registered command, a minimal capability file, and no filesystem or
shell permissions.

## Packages

| Path                 | Name                  | Purpose                                                   |
| -------------------- | --------------------- | --------------------------------------------------------- |
| `packages/cli`       | `@winforge/cli`       | The `winforge` binary (TypeScript → ESM, `bin: winforge`) |
| `packages/templates` | `@winforge/templates` | Electron/Tauri project templates + CI workflow template   |
| `packages/web-ui`    | `@winforge/web-ui`    | React + Vite UI that assembles the create command         |
| `examples/`          | —                     | Projects generated by the CLI, committed as living proof  |
| `docs/`              | —                     | Architecture, Windows builds, signing, CLI reference      |

`npm run build` compiles the CLI, copies `packages/templates/*` into
`packages/cli/templates` (so a published tarball is self-contained), and builds
the web UI. `scaffold.ts` resolves templates from either location.

## Data flow for `winforge create`

1. `prompts.ts` (or flags with `--non-interactive`) produce a `ProjectConfig`.
2. `validate.ts` validates every field: app name `[a-z][a-z0-9-_]*`, reverse-DNS
   package id, semver via the `semver` package, author and description length
   and character checks. Any error aborts before a single file is written.
3. `scaffold.ts` resolves the template directory, renders tokens, copies
   binaries, applies the UI-framework renderer swap (Vue/Svelte/vanilla), and
   writes `winforge.config.json`.
4. `runner.ts` optionally installs dependencies with the chosen package
   manager (`npm`, `pnpm`, `yarn`, `bun`).

## Data flow for `winforge ci`

`ci.ts` renders a workflow with three parallel jobs pinned to
`windows-latest`, `macos-latest` and `ubuntu-latest`, each installing only what
it needs (Rust + `rust-cache` for Tauri, webkit2gtk/rpm on Linux), building that
runner's native bundles, generating SHA-256 checksums, and uploading artifacts.
`--release` appends a job that attaches artifacts to a **draft** GitHub
Release on `v*` tags. Signing secrets are referenced by name only when
`--signing` is passed, and are never written into the file in plaintext.

See [`windows-builds.md`](windows-builds.md) for the platform-by-platform
explanation and [`signing.md`](signing.md) for the optional signing setup.
