# App icons

Replace these placeholders with your real icons before release:

- `icon.svg` — source icon (512×512, provided).
- `icon.ico` — Windows icon (256×256 PNG-in-ICO or multi-size ICO).
- `icon.icns` — macOS icon (generated from PNGs).
- `icon.png` — Linux icon (512×512 PNG).

Generate them from `icon.svg` with e.g.:

```bash
# Windows .ico (requires ImageMagick)
magick convert icon.svg -resize 256x256 icon.ico

# macOS .icns (macOS only)
iconutil -c icns icon.iconset
```

electron-builder references these files in `package.json` → `build.win.icon` etc.
