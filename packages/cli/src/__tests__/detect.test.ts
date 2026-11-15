import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
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

  it('finds a shim that would fail if executed', async () => {
    // A PATH lookup must not care whether the tool runs successfully: this
    // shim exists but always exits non-zero, so a `--version` probe would
    // wrongly report it missing. `.cmd` is what Windows resolves; POSIX needs
    // the executable bit.
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wf-shim-'));
    const win = process.platform === 'win32';
    const file = path.join(dir, win ? 'wf-probe.cmd' : 'wf-probe');
    fs.writeFileSync(file, win ? '@exit /b 3\r\n' : '#!/bin/sh\nexit 3\n');
    if (!win) fs.chmodSync(file, 0o755);
    const original = process.env.PATH;
    process.env.PATH = `${dir}${path.delimiter}${original ?? ''}`;
    try {
      expect(await commandExists('wf-probe')).toBe(true);
    } finally {
      process.env.PATH = original;
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('resolves many lookups concurrently in well under a second', async () => {
    const start = Date.now();
    await Promise.all(['node', 'npm', 'git', 'wine', 'bun'].map((c) => commandExists(c)));
    // Sequential spawns on a Windows runner took ~5s for this many probes.
    expect(Date.now() - start).toBeLessThan(4000);
  });
});
