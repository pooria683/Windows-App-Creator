# Windows signing for Tauri (OPTIONAL — disabled by default)

Tauri Windows bundles (NSIS `.exe`, WiX `.msi`) are unsigned by default.
To sign:

1. Obtain an Authenticode code-signing certificate.
2. Set `certificateThumbprint` in `src-tauri/tauri.conf.json` → `bundle.windows`
   (or use `signtool` in CI) and configure a timestamp server.
3. For updater signing, set `TAURI_SIGNING_PRIVATE_KEY` /
   `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` as GitHub secrets.

Never commit certificates or passwords. See WinForge `docs/signing.md`.
