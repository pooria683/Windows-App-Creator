# Tauri icons

Generate icons from a 1024×1024 PNG source:

```bash
# Requires @tauri-apps/cli
npx tauri icon path/to/icon.png
```

This produces `32x32.png`, `128x128.png`, `128x128@2x.png`, `icon.icns`, `icon.ico`
referenced by `tauri.conf.json` → `bundle.icon`.
