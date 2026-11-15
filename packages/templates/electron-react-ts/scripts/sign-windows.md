# Windows code signing (OPTIONAL — disabled by default)

Unsigned installers trigger Windows SmartScreen warnings ("Unknown publisher").
To sign with Authenticode:

1. Obtain a code-signing certificate (OV or EV) from a trusted CA.
2. Export it as `.pfx` and store it as a GitHub secret `WIN_CSC_LINK` (base64 or URL).
3. Set `WIN_CSC_KEY_PASSWORD` as a GitHub secret.
4. electron-builder picks these up automatically when present.

Locally (PowerShell):

```powershell
$env:WIN_CSC_LINK = "C:\path\to\cert.pfx"
$env:WIN_CSC_KEY_PASSWORD = "your-password"
npm run build:windows
```

Never commit certificates or passwords to git. See docs/signing.md in the WinForge repo.
