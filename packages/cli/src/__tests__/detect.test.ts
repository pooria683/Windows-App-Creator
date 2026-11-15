import { describe, it, expect } from 'vitest';
import { detectHost, buildCapabilities, commandExists } from '../lib/detect.js';

describe('detectHost', () => {
  it('returns a valid host shape', () => {
    const host = detectHost();
    expect(['windows', 'macos', 'linux', 'unknown']).toContain(host.os);
    expect(['x64', 'arm64', 'unknown']).toContain(host.arch);
    expect(host.cpus).toBeGreaterThan(0);
  });
});

describe('buildCapabilities', () => {
  it('Tauri on macOS cannot build Windows locally', () => {
    const caps = buildCapabilities(
      { os: 'macos', arch: 'arm64', platform: 'darwin', release: '', cpus: 8 },
      'tauri',
    );
    const win = caps.find((c) => c.target === 'windows')!;
    expect(win.canBuildLocally).toBe(false);
    expect(win.method).toMatch(/GitHub Actions/);
  });

  it('Electron on macOS can cross-build Windows', () => {
    const caps = buildCapabilities(
      { os: 'macos', arch: 'arm64', platform: 'darwin', release: '', cpus: 8 },
      'electron',
    );
    const win = caps.find((c) => c.target === 'windows')!;
    expect(win.canBuildLocally).toBe(true);
  });

  it('Windows host can build Windows natively', () => {
    const caps = buildCapabilities(
      { os: 'windows', arch: 'x64', platform: 'win32', release: '', cpus: 8 },
      'tauri',
    );
    expect(caps.find((c) => c.target === 'windows')!.canBuildLocally).toBe(true);
  });

  it('Linux host can build Linux natively', () => {
    const caps = buildCapabilities(
      { os: 'linux', arch: 'x64', platform: 'linux', release: '', cpus: 4 },
      'electron',
    );
    expect(caps.find((c) => c.target === 'linux')!.canBuildLocally).toBe(true);
  });

  it('always returns 3 targets', () => {
    const caps = buildCapabilities(detectHost(), 'electron');
    expect(caps).toHaveLength(3);
  });
});

describe('commandExists platform lookup', () => {
  it('detects a command that exists (uses where on Windows, which elsewhere)', async () => {
    // `node` must be present in the test process's PATH.
    expect(await commandExists('node')).toBe(true);
  });

  it('returns false for a command that does not exist', async () => {
    expect(await commandExists('winforge-definitely-not-a-real-binary')).toBe(false);
  });
});
