import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { scaffoldProject, renderTokens } from '../lib/scaffold.js';
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
