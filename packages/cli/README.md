# @winforge/cli

CLI for [WinForge](https://github.com/pooria683/Windows-App-Creator) — scaffold,
develop, build and package Windows desktop apps (Electron & Tauri) from macOS
and Linux, with macOS/Linux builds too.

```bash
npm install -g @winforge/cli
winforge doctor
winforge create my-app --template electron
cd my-app && winforge dev
winforge build --target windows
winforge ci --release
```

| Command | Purpose |
| --- | --- |
| `winforge create <name>` | Scaffold Electron or Tauri + React/Vue/Svelte/vanilla |
| `winforge dev` | Local development with hot reload |
| `winforge build --target windows\|macos\|linux\|all` | Build for a platform, explaining what needs CI |
| `winforge package --format exe\|msi\|dmg\|appimage\|deb\|rpm` | Produce one installer |
| `winforge ci` | Generate a 3-OS GitHub Actions workflow |
| `winforge doctor` | Detect missing tools and print install instructions |

`winforge create` validates every input (app name, reverse-DNS package id,
semver, author, description) before writing anything, and generated projects
use a secure Electron preload/contextBridge by default (`nodeIntegration` off).

Signing (Windows Authenticode, macOS notarization, Linux GPG) is **optional and
disabled by default**. Unsigned installers are not production-ready.

Full docs: [`docs/cli-reference.md`](https://github.com/pooria683/Windows-App-Creator/blob/main/docs/cli-reference.md).

Licence: MIT.
