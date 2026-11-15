import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { defaultConfig, findConfigFile, loadConfig, validateLoadedConfig } from '../lib/config.js';

describe('defaultConfig', () => {
  it('fills sensible defaults', () => {
    const c = defaultConfig({ name: 'demo' });
    expect(c.name).toBe('demo');
    expect(c.appName).toBe('demo');
    expect(c.version).toBe('0.1.0');
    expect(c.template).toBe('electron');
    expect(c.packageManager).toBe('npm');
  });

  it('leaves signing disabled on every platform', () => {
    const c = defaultConfig({});
    expect(c.signing?.windows?.enabled).toBe(false);
    expect(c.signing?.macos?.enabled).toBe(false);
    expect(c.signing?.linux?.enabled).toBe(false);
  });
});

describe('validateLoadedConfig', () => {
  it('accepts a valid config', () => {
    expect(validateLoadedConfig(defaultConfig({ name: 'demo' }))).toEqual([]);
  });

  it('reports invalid package id, version and template', () => {
    const bad = {
      ...defaultConfig({ name: 'demo' }),
      packageId: 'not-reverse-dns',
      version: 'v1.0',
    };
    const errors = validateLoadedConfig(bad);
    expect(errors.some((e) => e.startsWith('packageId:'))).toBe(true);
    expect(errors.some((e) => e.startsWith('version:'))).toBe(true);
  });

  it('rejects display names with shell/JSON metacharacters', () => {
    const bad = { ...defaultConfig({ name: 'demo' }), appName: 'Evil"; rm -rf /' };
    expect(validateLoadedConfig(bad).some((e) => e.startsWith('appName:'))).toBe(true);
  });
});

describe('findConfigFile / loadConfig', () => {
  let tmp: string;
  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'winforge-cfg-'));
  });
  afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('finds the config in a parent directory', () => {
    const cfg = defaultConfig({ name: 'demo' });
    fs.writeFileSync(path.join(tmp, 'winforge.config.json'), JSON.stringify(cfg));
    const nested = path.join(tmp, 'a', 'b');
    fs.mkdirSync(nested, { recursive: true });
    expect(findConfigFile(nested)).toBe(path.join(tmp, 'winforge.config.json'));
  });

  it('loads and validates the config', async () => {
    const cfg = defaultConfig({ name: 'demo', template: 'tauri' });
    fs.writeFileSync(path.join(tmp, 'winforge.config.json'), JSON.stringify(cfg));
    const loaded = await loadConfig(tmp);
    expect(loaded.config.template).toBe('tauri');
    expect(loaded.projectRoot).toBe(tmp);
  });

  it('throws a helpful error when the config is invalid', async () => {
    fs.writeFileSync(
      path.join(tmp, 'winforge.config.json'),
      JSON.stringify({ ...defaultConfig({ name: 'demo' }), packageId: 'nope' }),
    );
    await expect(loadConfig(tmp)).rejects.toThrow(/Invalid winforge.config.json/);
  });

  it('explains when no config exists', async () => {
    await expect(loadConfig(tmp)).rejects.toThrow(/winforge create/);
  });
});
