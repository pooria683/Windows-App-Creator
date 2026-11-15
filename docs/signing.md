# Code signing and notarization (optional, disabled by default)

WinForge **never** signs anything for you out of the box, and never stores
certificates or passwords in the repository. Freshly generated projects carry:

```json
{
  "signing": {
    "windows": { "enabled": false },
    "macos": { "enabled": false },
    "linux": { "enabled": false }
  }
}
```

inside `winforge.config.json`. Unsigned installers **are not production-ready**:
Windows SmartScreen shows "Unknown publisher", macOS Gatekeeper blocks
unsigned/unnotarized apps by default, and Linux users see no verified
maintainer. Signing is the step that changes that — you supply the
certificates, the CLI never invents them.

> Rule: certificates, `.pfx` files, API keys and passwords live in your CI
> provider's secret store (or a local, git-ignored path). Never in git, never
> in `package.json`, never in a workflow file.

---

## Windows — Authenticode

You need a code-signing certificate from a trusted CA (OV or EV; EV
certificates get SmartScreen reputation immediately). Hardware-token
certificates usually require signing on Windows, which is another reason to
sign on `windows-latest`.

### CI (recommended)

1. Export the certificate as `.pfx`.
2. Base64-encode it: `base64 -w0 cert.pfx > cert.b64` (macOS:
   `base64 -i cert.pfx | tr -d '\n'`).
3. Add repository secrets:
   - `WIN_CSC_LINK` — the base64 string, or a URL to the `.pfx`
   - `WIN_CSC_KEY_PASSWORD` — the `.pfx` password
4. Generate a signing-aware workflow:

   ```bash
   winforge ci --signing --force
   ```

The Electron job passes those secrets to `electron-builder`, which signs the
NSIS installer and portable `.exe` automatically when `WIN_CSC_LINK` is set.

### Local Windows machine

```powershell
$env:WIN_CSC_LINK = "C:\certs\cert.pfx"
$env:WIN_CSC_KEY_PASSWORD = "…"
npm run build:windows
```

### Verifying a Windows signature

```powershell
Get-AuthenticodeSignature .\release\MyApp-0.1.0-x64.exe | Format-List
# Status should be: Valid
```

### Tauri on Windows

Tauri signs through `signtool`. Set `certificateThumbprint` in
`src-tauri/tauri.conf.json` → `bundle.windows` (thumbprint comes from
`certutil -user -store my`), keep `digestAlgorithm: "sha256"` and a timestamp
URL, and install the certificate into the runner's certificate store before
`tauri build`.

---

## macOS — signing + notarization

Required for distribution outside your own machine. You need an Apple
Developer Program membership (99 USD/year), a "Developer ID Application"
certificate, and an app-specific password (or App Store Connect API key).

### CI

Add repository secrets:

- `MAC_CSC_LINK` — base64 `.p12` Developer ID certificate
- `MAC_CSC_KEY_PASSWORD` — its password
- `APPLE_ID` — Apple account email
- `APPLE_APP_SPECIFIC_PASSWORD` — generated at appleid.apple.com
- `APPLE_TEAM_ID` — 10-character team identifier

Then:

```bash
winforge ci --signing --force
```

electron-builder signs and notarizes the `.dmg` when those variables are
present. For Tauri, set `bundle.macOS.signingIdentity` and provide
`APPLE_ID`, `APPLE_PASSWORD` and `APPLE_TEAM_ID` to `tauri build` (Tauri's
bundler notarizes automatically when they are set).

### Verify notarization

```bash
spctl --assess --type execute --verbose MyApp.app
# accepted, source=Notarized Developer ID
xcrun stapler validate MyApp.dmg
```

---

## Linux — package signing

Linux distributions do not have a single Authenticode equivalent. What makes a
package trustworthy is a **GPG signature over the artifact** and a repository
users can verify.

```bash
# Generate a signing key (once, offline, protected by a passphrase)
gpg --full-generate-key

# Detach-sign the release artifacts
gpg --armor --detach-sign --output MyApp-0.1.0-x86_64.AppImage.asc \
  MyApp-0.1.0-x86_64.AppImage
gpg --armor --detach-sign --output MyApp_0.1.0_amd64.deb.asc \
  MyApp_0.1.0_amd64.deb
gpg --armor --detach-sign --output MyApp-0.1.0.x86_64.rpm.asc \
  MyApp-0.1.0.x86_64.rpm
```

Publish the public key and the `.asc` files next to the artifacts, and tell
users how to verify:

```bash
gpg --verify MyApp_0.1.0_amd64.deb.asc MyApp_0.1.0_amd64.deb
sha256sum -c SHA256SUMS.txt
```

If you publish a repository (APT/RPM), sign the `Release`/`repomd.xml`
metadata with the same key. For CI, store the private key as an armored secret
(e.g. `GPG_PRIVATE_KEY`) and import it only inside the release job —
electron-builder itself does not sign Linux packages.

---

## Enabling signing in `winforge.config.json`

After you have the materials in place, record _how_ — never _what_:

```json
{
  "signing": {
    "windows": {
      "enabled": true,
      "certificatePasswordEnv": "WIN_CSC_KEY_PASSWORD"
    },
    "macos": {
      "enabled": true,
      "identity": "Developer ID Application: Your Name (TEAMID)",
      "appleIdEnv": "APPLE_ID",
      "appleTeamIdEnv": "APPLE_TEAM_ID",
      "applePasswordEnv": "APPLE_APP_SPECIFIC_PASSWORD"
    },
    "linux": { "enabled": true, "gpgKeyId": "ABCDEF0123456789" }
  }
}
```

Only environment-variable **names** are stored — the values stay in your shell
or your CI secret store.

## Checklist before calling a build "release-ready"

- [ ] `winforge doctor` reports no missing required tools
- [ ] Installer built on the matching OS (`winforge ci` artifacts, not a Wine
      cross-build)
- [ ] Windows signature verifies (`Get-AuthenticodeSignature` → `Valid`)
- [ ] macOS `spctl --assess` → `accepted`, `stapler validate` passes
- [ ] Linux `.deb`/`.rpm`/AppImage signatures and `SHA256SUMS.txt` published
- [ ] Installer actually installed and launched on a clean Windows VM / Mac
- [ ] Version bumped with semver (`npm version patch|minor|major`)

Until every box is ticked, treat the installer as a **test build** and say so.
