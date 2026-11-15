# GitHub Actions workflow templates

| File        | Purpose                                                                                      |
| ----------- | -------------------------------------------------------------------------------------------- |
| `build.yml` | Generic 3-OS build workflow for any WinForge project. Copy to `.github/workflows/build.yml`. |

Prefer generating a project-specific workflow inside your app:

```bash
winforge ci                 # unsigned builds (default)
winforge ci --release       # + draft GitHub Release on v* tags
winforge ci --msi           # + Windows .msi
winforge ci --signing       # + code-signing secrets (see docs/signing.md)
```

`winforge ci` writes to `.github/workflows/build.yml` and refuses to
overwrite an existing file unless you pass `--force`.

## What the workflow does

| Runner           | Output                                                  |
| ---------------- | ------------------------------------------------------- |
| `windows-latest` | NSIS `.exe` installer, portable `.exe`, optional `.msi` |
| `macos-latest`   | `.dmg` (and `.zip` for Electron)                        |
| `ubuntu-latest`  | `.AppImage`, `.deb`, `.rpm`                             |

All artifacts are uploaded to the workflow run (`Actions → run → Artifacts`).
On `v*` tags the optional release job opens a **draft** GitHub Release —
review installers before publishing, they are unsigned unless you configure
signing.

## Why not build everything locally?

- **Tauri** cannot cross-compile Windows binaries from macOS/Linux: Rust needs
  the MSVC toolchain and Windows SDK. Windows builds must run on `windows-latest`.
- **macOS `.dmg`** requires Apple tooling (only on macOS runners).
- **Electron** _can_ cross-build unsigned NSIS/portable from macOS/Linux, but
  signing and notarization still require the matching native OS.

See `docs/windows-builds.md` and `docs/signing.md` in the WinForge repo.
