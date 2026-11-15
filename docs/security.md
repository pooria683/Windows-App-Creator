# Security model

WinForge generates desktop apps, and desktop apps are a high-trust surface: a
renderer-process compromise is usually a full user compromise if Node.js is
reachable. The templates therefore ship a locked-down default and the CLI
validates everything it writes.

## Electron template

| Setting            | Value                                            | Why                                                                                                  |
| ------------------ | ------------------------------------------------ | ---------------------------------------------------------------------------------------------------- |
| `nodeIntegration`  | `false`                                          | Renderer JavaScript cannot `require()` Node modules — the classic Electron RCE path.                 |
| `contextIsolation` | `true`                                           | Preload and page share no JS context; the page cannot tamper with the preload.                       |
| `sandbox`          | `true`                                           | The renderer runs in a Chromium sandbox.                                                             |
| `preload`          | `preload.cts` (CommonJS)                         | Sandboxed preloads cannot be ES modules — the template compiles this one file to CJS.                |
| Exposed API        | `contextBridge.exposeInMainWorld('winforge', …)` | Exactly two functions: `getAppInfo()` and `openExternal(url)`. Never `ipcRenderer`, `fs` or `shell`. |

**IPC hardening**

- Every handler validates its arguments in the main process
  (`typeof url === 'string' && url.startsWith('https://')`), so a compromised
  renderer cannot open `file://`, `javascript:` or `smb://` URLs.
- `setWindowOpenHandler` denies all in-app windows and opens `https://` links in
  the system browser instead.
- A strict `Content-Security-Policy` (`default-src 'self'; script-src 'self'`)
  is set in the packaged renderer. The dev-only CSP relaxation for Vite HMR is
  applied through `session.webRequest` and never ships.

**What is deliberately _not_ exposed**

No filesystem, shell, child-process, clipboard-write or auto-updater API. Add
each one explicitly (and validate its arguments) if your app needs it — the
template is a floor, not a ceiling.

## Tauri template

- One registered command (`get_app_info`), declared with
  `tauri::generate_handler!`. Unregistered commands are unreachable.
- `src-tauri/capabilities/default.json` grants only `core:default` to the main
  window — no `fs`, `shell`, `http` or `process` permissions.
- CSP set in `tauri.conf.json` (`default-src 'self'; script-src 'self'`).
- No updater signing key committed; `TAURI_SIGNING_PRIVATE_KEY` is an optional
  environment secret.

## Renderer overlays (Vue / Svelte / vanilla)

Overlays replace only the renderer entry and its build tooling. They keep the
same preload/IPC boundary, so switching frameworks does not change the security
model. The vanilla renderer builds DOM with `textContent`/`createElement`
instead of `innerHTML`.

## CLI input validation

Nothing is written until every field validates (`lib/validate.ts`):

| Field         | Rule                                                                            |
| ------------- | ------------------------------------------------------------------------------- |
| `name`        | `^[a-z][a-z0-9-_]*$`, 2–64 chars, not reserved (`dist`, `release`, …)           |
| `appName`     | 1–80 chars; rejects `< > " ' \` $ \\ { } \| ; & / : * ?` and control chars      |
| `packageId`   | reverse-DNS, ≤ 128 chars                                                        |
| `version`     | semver, no leading `v` (rejected explicitly — `semver.valid()` would coerce it) |
| `author`      | 1–120 chars, no shell metacharacters                                            |
| `description` | ≤ 280 chars                                                                     |

`winforge.config.json` is re-validated on every `dev`/`build`/`package`/`ci`
run, so a hand-edited file cannot silently produce a broken build.

**Why the display-name rules are strict:** `appName` flows into `package.json`,
`tauri.conf.json`, installer metadata, README files and (in CI) YAML. Rejecting
quotes, backslashes and shell metacharacters prevents template/JSON/YAML
breakage from a hostile or careless display name.

**No template evaluation.** `scaffold.ts` performs a single regex substitution
of a fixed `{{TOKEN}}` set. There is no Handlebars/EJS, no `eval`, no shelling
out with interpolated user input. Binary assets are byte-copied, never text-
substituted.

## Secrets

- No secrets, tokens or certificates exist in templates, workflows or examples.
- Signing config stores **environment variable names**, never values.
- The generated CI workflow references secrets only when `winforge ci --signing`
  is used, and only as `${{ secrets.NAME }}`.
- `.gitignore` excludes `*.pfx`, `*.p12`, `*.pem`, `*.key`, `*.cer` and `.env*`.

## Reporting a problem

Open an issue at
<https://github.com/pooria683/Windows-App-Creator/issues> (or email the
maintainer privately for vulnerabilities). Please don't include working
exploits or credentials in a public issue.
