import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { scaffoldProject, renderTokens, scriptPrefix, wixUpgradeCode } from '../lib/scaffold.js';
import type { ProjectConfig } from '../lib/validate.js';

const cfg: ProjectConfig = {
  name: 'my-app',
  appName: 'My App',
  packageId: 'com.example.myapp',
  version: '1.2.3',
  author: 'Acme Inc.',
  description: 'A test app.',
  template: 'electron',
  ui: 'react',
  packageManager: 'npm',
};

describe('renderTokens', () => {
  it('replaces known tokens and leaves unknown ones', () => {
    expect(renderTokens('Hello {{APP_NAME}} {{UNKNOWN}}', { APP_NAME: 'x' })).toBe(
      'Hello x {{UNKNOWN}}',
    );
  });
});

describe('scaffoldProject', () => {
  let tmp: string;
  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'winforge-test-'));
  });
  afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('scaffolds an Electron project with substituted tokens', () => {
    const files = scaffoldProject(cfg, path.join(tmp, 'proj'));
    expect(files.length).toBeGreaterThan(10);
    const pkg = JSON.parse(fs.readFileSync(path.join(tmp, 'proj/package.json'), 'utf8'));
    expect(pkg.name).toBe('my-app');
    expect(pkg.version).toBe('1.2.3');
    expect(pkg.description).toBe('A test app.');
    // No unreplaced tokens should remain in key files.
    const readme = fs.readFileSync(path.join(tmp, 'proj/README.md'), 'utf8');
    expect(readme).not.toContain('{{APP_NAME}}');
    expect(readme).toContain('My App');
    // winforge.config.json is written.
    const wf = JSON.parse(fs.readFileSync(path.join(tmp, 'proj/winforge.config.json'), 'utf8'));
    expect(wf.packageId).toBe('com.example.myapp');
    expect(wf.signing.windows.enabled).toBe(false);
  });

  it('scaffolds a Tauri project', () => {
    const files = scaffoldProject({ ...cfg, template: 'tauri' }, path.join(tmp, 'tauri-proj'));
    expect(files).toContain('src-tauri/tauri.conf.json');
    const tauriConf = JSON.parse(
      fs.readFileSync(path.join(tmp, 'tauri-proj/src-tauri/tauri.conf.json'), 'utf8'),
    );
    expect(tauriConf.productName).toBe('MyApp');
    expect(tauriConf.version).toBe('1.2.3');
    expect(tauriConf.identifier).toBe('com.example.myapp');
  });

  it('is idempotent (re-scaffolding produces same files)', () => {
    const dest = path.join(tmp, 'idem');
    const a = scaffoldProject(cfg, dest);
    const b = scaffoldProject(cfg, dest);
    expect(a.sort()).toEqual(b.sort());
  });
});

describe('script prefix tokens', () => {
  it('maps package managers to the right command form', () => {
    expect(scriptPrefix('npm')).toBe('npm run ');
    expect(scriptPrefix('pnpm')).toBe('pnpm run ');
    expect(scriptPrefix('bun')).toBe('bun run ');
    expect(scriptPrefix('yarn')).toBe('yarn ');
  });

  it('renders package-manager-accurate README instructions', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'winforge-pm-'));
    for (const pm of ['npm', 'pnpm', 'yarn', 'bun'] as const) {
      const dir = path.join(tmp, pm);
      scaffoldProject({ ...cfg, packageManager: pm }, dir);
      const readme = fs.readFileSync(path.join(dir, 'README.md'), 'utf8');
      expect(readme).not.toContain('{{RUN_SCRIPT_PREFIX}}');
      if (pm === 'yarn') {
        expect(readme).toContain('yarn dev');
        expect(readme).not.toContain('yarn run dev');
      } else {
        expect(readme).toContain(`${pm} run dev`);
      }
    }
    fs.rmSync(tmp, { recursive: true, force: true });
  });
});

describe('platform-independent file reporting', () => {
  it('reports nested paths POSIX-style (same on Windows and Unix)', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'winforge-posix-'));
    try {
      const files = scaffoldProject({ ...cfg, template: 'tauri' }, path.join(tmp, 'proj'));
      // Every reported path must use "/" — never a backslash separator.
      for (const f of files) {
        expect(f).not.toContain('\\');
      }
      expect(files).toContain('src-tauri/tauri.conf.json');
      expect(files).toContain('src-tauri/capabilities/default.json');
      expect(files).toContain('src/renderer/src/App.tsx');
      expect(files).toContain('winforge.config.json');
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });
});

describe('WiX upgradeCode (Windows Installer identity)', () => {
  it('is deterministic for a package id so upgrades replace the old version', () => {
    expect(wixUpgradeCode('com.acme.alpha')).toBe(wixUpgradeCode('com.acme.alpha'));
  });

  it('differs between package ids so two apps are not treated as one', () => {
    const codes = new Set(
      Array.from({ length: 200 }, (_, i) => wixUpgradeCode(`com.acme.app${i}`)),
    );
    expect(codes.size).toBe(200);
  });

  it('is a valid RFC 4122 v5 UUID', () => {
    expect(wixUpgradeCode('com.acme.alpha')).toMatch(
      /^[0-9A-F]{8}-[0-9A-F]{4}-5[0-9A-F]{3}-[89AB][0-9A-F]{3}-[0-9A-F]{12}$/,
    );
  });

  it('is written into the generated Tauri config', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'winforge-wix-'));
    try {
      const dir = path.join(tmp, 'proj');
      scaffoldProject({ ...cfg, template: 'tauri', packageId: 'com.acme.wix' }, dir);
      const conf = JSON.parse(fs.readFileSync(path.join(dir, 'src-tauri/tauri.conf.json'), 'utf8'));
      expect(conf.bundle.windows.wix.upgradeCode).toBe(wixUpgradeCode('com.acme.wix'));
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });
});
