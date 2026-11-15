# What has been verified (and what has not)

Honesty about tested state matters as much as honest docs. This page records
exactly what was executed while building WinForge, so nobody has to guess.

## Verified ✅

| Area                            | Command                                                                      | Result                                                          |
| ------------------------------- | ---------------------------------------------------------------------------- | --------------------------------------------------------------- |
| Monorepo install                | `npm install`                                                                | 215 packages, clean                                             |
| CLI build                       | `npm run build`                                                              | `tsc` + template copy + web UI build succeed                    |
| Typecheck                       | `npm run typecheck`                                                          | No errors in any workspace                                      |
| Lint                            | `npm run lint`                                                               | 0 errors, 0 warnings (typescript-eslint, flat config)           |
| Unit + integration tests        | `npm test`                                                                   | **90 tests** pass (77 CLI, 2 template, 11 web UI)               |
| CLI binary                      | `node packages/cli/dist/index.js --help`                                     | All six commands listed                                         |
| Scaffolding                     | `create … --non-interactive`                                                 | Electron (28 files) and Tauri (35 files) generated              |
| Input validation                | integration tests                                                            | Invalid name/package id/version exits 1 with no files written   |
| Idempotency                     | re-scaffold + `ci` rerun                                                     | Same output; `ci` refuses to overwrite without `--force`        |
| Generated Electron app          | `npm install && npm run build:web && npm run build:main && npx tsc --noEmit` | Compiles, typechecks, Vitest passes                             |
| Generated Tauri app             | `npm install && npx tsc --noEmit && npm run build:web`                       | Compiles, typechecks, Vitest passes                             |
| Vue / Svelte / vanilla variants | `npm install && npm run build:web`                                           | All three produce real bundles (no React leftovers)             |
| Workflow generation             | `winforge ci [--release] [--signing] [--msi]`                                | Valid YAML; parsed with PyYAML in review                        |
| Capability matrix               | `winforge doctor --json`                                                     | Reports linux/x64; Windows ✔ for Electron, ✖ for macOS on Linux |
| Examples match templates        | `npm run verify:examples`                                                    | Both examples byte-identical to fresh scaffolds                 |
| Web UI                          | `npm run dev:web`                                                            | Serves on `0.0.0.0:4173`, validates input, copies command       |

## Not verified — environment limits ⚠️

These need network access to Electron/Windows tooling that this build sandbox
does not provide. They are **not** claimed to work:

| Area                                        | Why not                                                                                                  | How to check                                                                                                               |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Windows `.exe` produced by electron-builder | The Electron binary download is blocked by the sandbox TLS proxy (`ERR_ELECTRON_BUILDER_CANNOT_EXECUTE`) | `cd examples/electron-hello && npm install && npm run build:windows` on a normal machine (Wine on macOS/Linux, or Windows) |
| Windows `.msi` (WiX)                        | Same, plus WiX is Windows-only in practice                                                               | `winforge ci --msi` and download the artifact                                                                              |
| Tauri native build                          | Rust toolchain + Windows/Linux system libs not installed here                                            | `winforge ci` on GitHub, or a machine with rustup                                                                          |
| macOS `.dmg` / notarization                 | Requires macOS                                                                                           | `macos-latest` runner                                                                                                      |
| Code signing                                | Needs real certificates                                                                                  | See [`signing.md`](signing.md)                                                                                             |
| Installer runs on a clean Windows machine   | Needs a Windows VM                                                                                       | Manual smoke test before release                                                                                           |

**Practical consequence:** treat all installers produced by a fresh clone as
test builds. Verify them on the target OS, and sign them, before distributing.

## Windows-specific fixes found by CI

The first CI run failed on `windows-latest` and passed on Ubuntu/macOS. Two real
cross-platform bugs were found and fixed (both now covered by tests that run on
every OS):

1. **CRLF checkouts broke string patching.** Without `.gitattributes`, the
   Windows runner checks out with `core.autocrlf=true`, so `vite.config.ts`
   arrived with `\r\n`. The renderer overlay's exact-match replacements
   (which include `\n`) silently matched nothing, leaving React imports in a
   Vue/Svelte/vanilla project. Fixed by (a) adding `.gitattributes` with
   `* text=auto eol=lf` and real binary markers for icons, and (b) making the
   patchers line-ending agnostic (`patchTextFile` normalises, patches, and
   restores the file's original endings).
2. **Reported file paths used the host separator.** `scaffoldProject()` built
   relative paths with `path.join`, so Windows reported nested files with a
   backslash separator instead of `src-tauri/tauri.conf.json`. Fixed by
   composing POSIX-style relative paths while still using `path.join` for the
   real filesystem path.

The CI workflow's own smoke tests also no longer hardcode `/tmp` (they use
`${{ runner.temp }}`), and now additionally scaffold a Vue project, install it,
and run its renderer + main builds on all three operating systems.

## Reproducing the verification

```bash
npm install
npm run build
npm test
npm run lint
npm run typecheck
npm run verify:examples
node packages/cli/dist/index.js doctor

# generated-app checks
cd examples/electron-hello && npm install && npm run build:web && npm run build:main && npx tsc --noEmit
cd ../tauri-hello && npm install && npm run build:web && npx tsc --noEmit
```
