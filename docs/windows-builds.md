# How Windows builds are produced from macOS and Linux

This is the part most desktop generators hand-wave. WinForge does not: the
CLI computes what your machine can actually build, and for everything else it
generates the GitHub Actions workflow that will.

## TL;DR

| Your host                       | Electron → Windows                                                                                           | Tauri → Windows                                      |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------- |
| macOS (Intel/Apple Silicon)     | **Yes, locally** — electron-builder cross-compiles unsigned NSIS `.exe` + portable `.exe` (Wine recommended) | **No** — Rust needs the MSVC toolchain + Windows SDK |
| Linux (x64/arm64)               | **Yes, locally** — same as above; Wine from your distro packages                                             | **No** — same reason                                 |
| Windows                         | Yes, natively (and the only place to sign)                                                                   | Yes, natively (and the only place to sign)           |
| GitHub Actions `windows-latest` | Yes, signed or unsigned                                                                                      | Yes, signed or unsigned                              |

Both templates also build `.dmg` (macOS) and `.AppImage`/`.deb`/`.rpm` (Linux).
macOS artifacts require `macos-latest` unless you are on a Mac; Linux packages
require a Linux machine (or the `ubuntu-latest` runner).

## Why Electron can cross-build but Tauri cannot

**Electron** ships prebuilt, per-platform binaries. `electron-builder` downloads
the Windows Electron distribution, drops your compiled renderer + main process
inside, and runs NSIS (and WiX for `.msi`) to package it. NSIS is a Windows
program, so on macOS/Linux electron-builder invokes it **through Wine**. That
works for unsigned installers. It does not give you Authenticode signing
(Microsoft's signtool is Windows-only), so a "production" Windows installer
still belongs on a Windows runner.

**Tauri** compiles your app to a native binary with the Rust toolchain. A
Windows `.exe` needs the MSVC linker, the Windows SDK headers, and the WebView2
loader library — a toolchain that only exists on Windows. Cross-compiling via
`cargo-xwin` or `mingw-w64` is not supported by Tauri's bundler (NSIS/WiX
scripts expect Windows paths and tools). So the honest answer is: build Tauri
Windows apps on Windows. `winforge doctor` says exactly this on your machine.

macOS `.dmg` is a similar story: `hdiutil` and Apple code-signing/notarization
only run on macOS, which is why the workflow uses `macos-latest` rather than
trying to produce a `.dmg` on Linux.

## What `winforge build` does

```bash
winforge build --target windows   # checks capability, then runs build:windows
winforge build --target all       # builds what this host can, explains the rest
```

For each requested target the CLI looks up the capability matrix from
`lib/detect.ts`:

- **Buildable here** → it runs the project's own script (`build:windows`,
  `build:macos`, `build:linux`) with your package manager. The scripts wrap
  `electron-builder --win` / `tauri build --bundles nsis` etc., so nothing is
  re-implemented in the CLI.
- **Not buildable here** → it prints why (`method` + `notes`) and points at
  `winforge ci`, then continues with the remaining targets. It never fakes a
  build or claims success.

`winforge package --format <fmt>` works the same way but dispatches to the
per-format script (`package:msi`, `package:appimage`, …) and refuses formats
this host cannot produce.

## What `winforge ci` generates

```
winforge ci                 # unsigned, 3 parallel jobs
winforge ci --release       # + draft GitHub Release on v* tags
winforge ci --msi           # + Windows .msi (WiX)
winforge ci --signing       # wire signing secrets (still off by default)
```

- `build-windows` on `windows-latest`: `electron-builder --win nsis portable`
  (plus `msi` with `--msi`) or `tauri build --bundles nsis,msi`.
- `build-macos` on `macos-latest`: `.dmg` (+ `.zip` for Electron). Both
  architectures are built (electron-builder `--x64 --arm64`; Tauri
  `--target universal-apple-darwin`), so Intel Macs are covered even though
  the runner is Apple Silicon.
- `build-linux` on `ubuntu-latest`: AppImage, `.deb`, `.rpm`; Tauri jobs also
  install `libwebkit2gtk-4.1-dev`, `libappindicator3-dev`, `librsvg2-dev`,
  `patchelf` and `rpm`.
- Every Electron job writes `SHA256SUMS.txt` into `release/` before uploading.
- Artifacts are uploaded with `actions/upload-artifact@v4` and retained 14 days.
- With `--release`, a fourth job downloads all artifacts and opens a **draft**
  release — deliberate, so a human reviews unsigned installers before users see
  them.

## Local vs CI, honestly

|                              | Local (macOS/Linux)            | GitHub Actions        |
| ---------------------------- | ------------------------------ | --------------------- |
| Speed                        | Fast, no queue                 | ~5–15 min per run     |
| Windows `.exe` (Electron)    | Yes, via Wine                  | Yes                   |
| Windows `.exe` (Tauri)       | No                             | Yes                   |
| Windows `.msi`               | WiX on Wine — unreliable       | Yes (`--msi`)         |
| macOS `.dmg`                 | Only on macOS                  | Yes (`macos-latest`)  |
| Linux packages               | Only on Linux                  | Yes (`ubuntu-latest`) |
| Windows Authenticode signing | No (needs Windows)             | Yes, with secrets     |
| macOS notarization           | Only on macOS with credentials | Yes, with secrets     |
| Reproducibility              | Depends on your machine        | Pinned runners        |

The rule of thumb WinForge prints: **develop and smoke-test locally, ship from
CI.** Local Windows builds are for iterating on the installer, not for
distribution.

## Verifying a local cross-build

```bash
# On macOS or Linux, with Wine installed:
brew install --cask wine-stable        # macOS
sudo apt install wine wine64           # Debian/Ubuntu

cd examples/electron-hello
npm install
npm run build:windows
ls -lh release/
# MyApp-0.1.0-x64.exe          ← NSIS installer
# MyApp-0.1.0-x64-portable.exe ← portable build
```

Then test the installer in a Windows VM (or on a Windows machine) before
sharing it. An installer that has never been run on Windows is not verified,
signed or unsigned.

## Installer identity (why `upgradeCode` matters)

Windows Installer identifies an application by a **GUID**, not by its name. For
Tauri projects winforge writes `bundle.windows.wix.upgradeCode` from the
`packageId` as an RFC 4122 version-5 (name-based) UUID:

- the same `packageId` always produces the same GUID, so version 1.2 upgrades
  over 1.1 instead of sitting next to it;
- different `packageId` values produce different GUIDs, so two winforge apps
  never look like the same product to Windows.

If you change `packageId` after your first release, treat it as a new product:
the old install will not be replaced.
