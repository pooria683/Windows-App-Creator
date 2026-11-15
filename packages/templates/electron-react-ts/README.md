# {{APP_DISPLAY_NAME}}

{{DESCRIPTION}}

Built with [WinForge](https://github.com/pooria683/Windows-App-Creator) — Electron + React + TypeScript.

## Prerequisites

- Node.js >= 20 (https://nodejs.org)
- {{PACKAGE_MANAGER}} (or npm)
- Optional: Wine for Windows cross-builds on macOS/Linux (`brew install --cask wine-stable` / `sudo apt install wine`)

Check your environment:

```bash
npx winforge doctor
# or, from the WinForge repo:
node /path/to/winforge/packages/cli/dist/index.js doctor
```

## Setup

```bash
{{PACKAGE_MANAGER}} install
```

## Development (hot reload)

```bash
{{PACKAGE_MANAGER}} run dev
```

This starts Vite (renderer, http://127.0.0.1:5173) and Electron together.
The renderer has **no Node.js access** — it talks to the main process only
through the secure `window.winforge` bridge (`src/main/preload.ts`).

## Build

```bash
# Current host only
{{PACKAGE_MANAGER}} run build

# Specific targets
{{PACKAGE_MANAGER}} run build:windows   # NSIS .exe installer + portable .exe
{{PACKAGE_MANAGER}} run build:macos     # .dmg + .zip
{{PACKAGE_MANAGER}} run build:linux     # AppImage + .deb + .rpm
```

Artifacts land in `release/`.

> **Windows builds from macOS/Linux:** Electron can cross-compile Windows
> NSIS/portable installers from macOS/Linux (Wine recommended). For signed,
> production-grade installers use GitHub Actions (`winforge ci`).

## Package a single format

```bash
npx winforge package --format exe       # Windows NSIS installer
npx winforge package --format dmg       # macOS disk image
npx winforge package --format appimage  # Linux AppImage
```

## CI — build on GitHub Actions

```bash
npx winforge ci
git add .github/workflows/build.yml
git commit -m "Add WinForge CI workflow"
git push
```

The workflow builds Windows (`.exe`/`.msi`), macOS (`.dmg`) and Linux
(`.AppImage`/`.deb`/`.rpm`) on native runners and uploads all artifacts.
Push a tag (`git tag v0.1.0 && git push --tags`) to create a GitHub Release
(if generated with `--release`).

## Signing (optional, disabled by default)

Unsigned installers trigger OS warnings (SmartScreen / Gatekeeper).
See `scripts/sign-windows.md` and the WinForge `docs/signing.md` to configure
Windows Authenticode, macOS notarization and Linux GPG signing.
**Never commit certificates or passwords.**

## Tests & quality

```bash
{{PACKAGE_MANAGER}} run test        # Vitest
{{PACKAGE_MANAGER}} run lint        # ESLint
{{PACKAGE_MANAGER}} run typecheck   # tsc --noEmit
{{PACKAGE_MANAGER}} run format      # Prettier
```

## Project structure

```
src/
  main/       Electron main process + secure preload bridge
  renderer/   React + Vite renderer (sandboxed, no Node access)
  shared/     Types shared between main and renderer
tests/        Vitest unit tests
assets/       App icons (replace placeholders before release)
release/      Build artifacts (git-ignored)
```

## License

MIT — see LICENSE if present, otherwise contact {{AUTHOR}}.
