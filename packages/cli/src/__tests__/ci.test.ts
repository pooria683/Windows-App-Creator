import { describe, it, expect } from 'vitest';
import { renderWorkflow } from '../commands/ci.js';

const base = { appName: 'My App', template: 'electron', packageManager: 'npm', release: false };

/** Minimal structural check: workflows must not contain literal secrets. */
function assertNoLiteralSecrets(yml: string): void {
  expect(yml).not.toMatch(/BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY/);
  expect(yml).not.toMatch(/password:\s*['"]?[A-Za-z0-9!@#$%^&*]{6,}/i);
}

describe('renderWorkflow', () => {
  it('targets the three native runners', () => {
    const yml = renderWorkflow(base);
    expect(yml).toContain('windows-latest');
    expect(yml).toContain('macos-latest');
    expect(yml).toContain('ubuntu-latest');
    expect(yml).toContain('actions/upload-artifact@v4');
    expect(yml).not.toContain('action-gh-release');
  });

  it('declares a jobs mapping and per-OS jobs', () => {
    const yml = renderWorkflow(base);
    expect(yml).toMatch(/^jobs:\n {2}build-windows:$/m);
    expect(yml).toContain('build-windows:');
    expect(yml).toContain('build-macos:');
    expect(yml).toContain('build-linux:');
  });

  it('builds Electron with electron-builder native flags', () => {
    const yml = renderWorkflow(base);
    expect(yml).toContain('electron-builder --win nsis portable');
    expect(yml).toContain('electron-builder --mac dmg zip --x64 --arm64');
    expect(yml).toContain('electron-builder --linux AppImage deb rpm');
  });

  it('adds MSI only when requested', () => {
    expect(renderWorkflow(base)).not.toContain('--win nsis portable msi');
    expect(renderWorkflow({ ...base, msi: true })).toContain('--win nsis portable msi');
  });

  it('builds Tauri with per-OS bundles and installs Rust', () => {
    const yml = renderWorkflow({ ...base, template: 'tauri' });
    expect(yml).toContain('npx tauri build --bundles nsis');
    expect(yml).toContain('npx tauri build --target universal-apple-darwin --bundles dmg');
    expect(yml).toContain('npx tauri build --bundles appimage,deb,rpm');
    expect(yml).toContain('rust-toolchain@stable');
    // Linux-only system deps must not leak into the Windows job.
    expect(yml).toContain('libwebkit2gtk-4.1-dev');
  });

  it('does not reference signing secrets unless --signing is passed', () => {
    const unsigned = renderWorkflow(base);
    expect(unsigned).not.toContain('secrets.WIN_CSC_LINK');
    expect(unsigned).not.toContain('secrets.APPLE_ID');
    assertNoLiteralSecrets(unsigned);

    const signed = renderWorkflow({ ...base, signing: true });
    expect(signed).toContain('secrets.WIN_CSC_LINK');
    expect(signed).toContain('secrets.WIN_CSC_KEY_PASSWORD');
    expect(signed).toContain('secrets.APPLE_ID');
    expect(signed).toContain('secrets.APPLE_TEAM_ID');
    assertNoLiteralSecrets(signed);
  });

  it('references the Tauri updater key only when signing a Tauri project', () => {
    const yml = renderWorkflow({ ...base, template: 'tauri', signing: true });
    expect(yml).toContain('secrets.TAURI_SIGNING_PRIVATE_KEY');
    assertNoLiteralSecrets(yml);
  });

  it('adds a draft release job when requested', () => {
    const yml = renderWorkflow({ ...base, release: true });
    expect(yml).toContain('action-gh-release');
    expect(yml).toContain('draft: true');
    expect(yml).toContain('startsWith(github.ref, ');
    expect(yml).toContain('needs: [build-windows, build-macos, build-linux]');
  });

  it('respects pnpm / yarn / bun package managers', () => {
    expect(renderWorkflow({ ...base, packageManager: 'pnpm' })).toContain('pnpm/action-setup@v4');
    expect(renderWorkflow({ ...base, packageManager: 'yarn' })).toContain(
      'yarn install --frozen-lockfile',
    );
    expect(renderWorkflow({ ...base, packageManager: 'bun' })).toContain('oven-sh/setup-bun@v2');
  });

  it('states that unsigned builds are not production-ready', () => {
    const yml = renderWorkflow(base);
    expect(yml).toContain('NOT production-ready');
  });
});
