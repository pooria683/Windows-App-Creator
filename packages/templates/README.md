# @winforge/templates

Project and CI templates consumed by `@winforge/cli`.

| Directory | Contents |
| --- | --- |
| `electron-react-ts/` | Electron + React + TypeScript app (secure preload, electron-builder NSIS/portable/MSI, real icons) |
| `tauri-react-ts/` | Tauri + React + TypeScript app (Rust IPC, NSIS + WiX MSI config, real icons) |
| `renderers/` | Renderer overlays for Vue, Svelte and vanilla TS (complete, working replacements for React) |
| `github-actions/` | Generic 3-OS build workflow template |

Templates are plain directories with `{{TOKEN}}` placeholders
(`APP_NAME`, `APP_DISPLAY_NAME`, `PRODUCT_NAME`, `PACKAGE_ID`, `VERSION`,
`AUTHOR`, `DESCRIPTION`, `TEMPLATE`, `UI_FRAMEWORK`, `PACKAGE_MANAGER`, `YEAR`).
`@winforge/cli`'s `scaffold.ts` copies them and substitutes tokens — no
templating engine and no code execution.

`npm run build` in `packages/cli` copies these into `packages/cli/templates/`
so the published CLI tarball is self-contained.

Changes here should be followed by `npm run create:example` at the repo root to
refresh `examples/*`.
