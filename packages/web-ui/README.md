# @winforge/web-ui

A minimal React + Vite UI that helps you assemble the right `winforge create`
command and explains which installers can be built locally vs. on GitHub Actions.

It does **not** build or download anything: it validates input (mirroring the
CLI validators) and lets you copy the exact command.

```bash
npm run dev --workspace=@winforge/web-ui   # http://localhost:4173
npm run build --workspace=@winforge/web-ui
```

The dev server binds `0.0.0.0` and allows any preview host, so it works in
sandboxed/cloud previews.
