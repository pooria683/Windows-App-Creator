# CLI reference

```
winforge <command> [options]
```

Run `winforge <command> --help` for the authoritative flag list.

## `winforge create <project-name>`

Scaffold a project from a template, then install dependencies.

| Option                    | Description                                                                         |
| ------------------------- | ----------------------------------------------------------------------------------- |
| `--template <kind>`       | `electron` (default) or `tauri`                                                     |
| `--ui <framework>`        | `react` (default), `vue`, `svelte`, `vanilla`                                       |
| `--pm <manager>`          | `npm` (default), `pnpm`, `yarn`, `bun`                                              |
| `--app-name <name>`       | Display name (defaults to the project name)                                         |
| `--package-id <id>`       | Reverse-DNS id (default `com.example.<name>`)                                       |
| `--description <text>`    | App description                                                                     |
| `--author <name>`         | Author / publisher                                                                  |
| `--app-version <semver>`  | Initial app version (default `0.1.0`) — `--version` is reserved for the CLI version |
| `--non-interactive`       | Skip prompts, use flags and defaults                                                |
| `--no-install`            | Don't run the package manager                                                       |
| `--force`                 | Allow scaffolding into a non-empty directory                                        |
| `--templates-root <path>` | Advanced: use templates from a custom path                                          |

`<project-name>` may be a path; the app name is derived from its last segment.

Interactive mode prompts for app name, display name, framework, UI, package
manager, package id, version, author and description — every prompt is
validated before anything is written.

**Validation rules**

| Field       | Rule                                                                       |
| ----------- | -------------------------------------------------------------------------- |
| App name    | 2–64 chars, `[a-z][a-z0-9-_]*`, not a reserved word (`dist`, `release`, …) |
| Package id  | Reverse-DNS, e.g. `com.example.myapp`, ≤ 128 chars                         |
| Version     | Valid semver, no leading `v`                                               |
| Author      | 1–120 chars, no shell metacharacters (`<>"'`;                              | &$`) |
| Description | ≤ 280 chars                                                                |

## `winforge dev`

Runs the project's `dev` script (Vite + Electron, or Tauri dev with Rust hot
reload). Options: `--host <host>`, `--port <port>`.

## `winforge build --target <target>`

| Target    | Behaviour                                                                                     |
| --------- | --------------------------------------------------------------------------------------------- |
| `windows` | Electron: local via Wine, or CI. Tauri: CI only on macOS/Linux                                |
| `macos`   | Only on macOS (or `macos-latest`)                                                             |
| `linux`   | Only on Linux (or `ubuntu-latest`)                                                            |
| `all`     | Builds what this host supports, explains the rest, exits non-zero only on real build failures |

Artifacts: Electron → `release/`, Tauri → `src-tauri/target/release/bundle/`.

## `winforge package --format <format>`

| Format     | Platform | Script run                      |
| ---------- | -------- | ------------------------------- |
| `exe`      | Windows  | `package:exe` (NSIS + portable) |
| `msi`      | Windows  | `package:msi` (WiX)             |
| `dmg`      | macOS    | `package:dmg`                   |
| `appimage` | Linux    | `package:appimage`              |
| `deb`      | Linux    | `package:deb`                   |
| `rpm`      | Linux    | `package:rpm`                   |

Refuses formats the current host cannot produce and points at `winforge ci`.

## `winforge ci`

| Option            | Description                                                      |
| ----------------- | ---------------------------------------------------------------- |
| `--output <path>` | Workflow path (default `.github/workflows/build.yml`)            |
| `--release`       | Add a job that publishes a **draft** GitHub Release on `v*` tags |
| `--msi`           | Also build a Windows `.msi`                                      |
| `--signing`       | Wire signing secrets into the build steps (off by default)       |
| `--force`         | Overwrite an existing workflow                                   |

## `winforge doctor`

Detects Node, npm, git, pnpm/yarn/bun, Rust (for Tauri), Wine (for Electron
Windows cross-builds), and prints install instructions for anything missing.
Also prints the host OS/arch and the three-row capability matrix.

`--json` emits machine-readable output:

```json
{ "host": { "os": "macos", "arch": "arm64", ... },
  "template": "electron",
  "checks": [ { "name": "Node.js (>=20)", "ok": true, "version": "v20.11.1", ... } ],
  "capabilities": [ { "target": "windows", "canBuildLocally": true, ... } ] }
```

Exit code is `1` when a **required** dependency is missing, so it can gate CI.

## Exit codes

| Code | Meaning                                                                     |
| ---- | --------------------------------------------------------------------------- |
| `0`  | Success                                                                     |
| `1`  | Validation error, missing dependency, unavailable target, or a failed build |

## Package manager mapping

| Manager | Install        | Run script          | Notes                       |
| ------- | -------------- | ------------------- | --------------------------- |
| npm     | `npm install`  | `npm run <script>`  | default                     |
| pnpm    | `pnpm install` | `pnpm run <script>` | `corepack enable`           |
| yarn    | `yarn install` | `yarn <script>`     | classic or berry            |
| bun     | `bun install`  | `bun run <script>`  | CI uses `oven-sh/setup-bun` |
