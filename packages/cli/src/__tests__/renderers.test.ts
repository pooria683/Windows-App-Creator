import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { scaffoldProject } from '../lib/scaffold.js';
import {
  patchIndexHtml,
  patchPackageJson,
  patchViteConfig,
} from '../lib/renderers.js';
import type { ProjectConfig } from '../lib/validate.js';

const base: ProjectConfig = {
  name: 'my-app',
  appName: 'My App',
  packageId: 'com.example.myapp',
  version: '0.1.0',
  author: 'Acme',
  description: 'A test app.',
  template: 'electron',
  ui: 'react',
  packageManager: 'npm',
};

function read(p: string): string {
  return fs.readFileSync(p, 'utf8');
}

describe('renderer overlays', () => {
  let tmp: string;
  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'winforge-ui-'));
  });
  afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('leaves React projects untouched', () => {
    const dir = path.join(tmp, 'react');
    scaffoldProject({ ...base, ui: 'react' }, dir);
    expect(fs.existsSync(path.join(dir, 'src/renderer/src/App.tsx'))).toBe(true);
    expect(fs.existsSync(path.join(dir, 'src/renderer/src/main.tsx'))).toBe(true);
    expect(read(path.join(dir, 'vite.config.ts'))).toContain('plugins: [react()]');
  });

  it('builds a complete Vue project (no React leftovers)', () => {
    const dir = path.join(tmp, 'vue');
    scaffoldProject({ ...base, ui: 'vue' }, dir);

    expect(fs.existsSync(path.join(dir, 'src/renderer/src/App.vue'))).toBe(true);
    expect(fs.existsSync(path.join(dir, 'src/renderer/src/main.ts'))).toBe(true);
    expect(fs.existsSync(path.join(dir, 'src/renderer/src/App.tsx'))).toBe(false);
    expect(fs.existsSync(path.join(dir, 'src/renderer/src/main.tsx'))).toBe(false);

    const pkg = JSON.parse(read(path.join(dir, 'package.json')));
    expect(pkg.dependencies.vue).toBeTruthy();
    expect(pkg.dependencies.react).toBeUndefined();
    expect(pkg.devDependencies['@vitejs/plugin-vue']).toBeTruthy();
    expect(pkg.devDependencies['@vitejs/plugin-react']).toBeUndefined();

    expect(read(path.join(dir, 'vite.config.ts'))).toContain(
      "import vue from '@vitejs/plugin-vue'",
    );
    expect(read(path.join(dir, 'vite.config.ts'))).toContain('vue()');
    // Overlay files are token-rendered, not left with placeholders.
    expect(read(path.join(dir, 'src/renderer/src/App.vue'))).toContain('My App');
    // NB: Vue uses {{ }} interpolation, so only assert no ALL_CAPS tokens remain.
    expect(read(path.join(dir, 'src/renderer/src/App.vue'))).not.toMatch(/\{\{[A-Z_]+\}\}/);
    // index.html points at the new entry.
    expect(read(path.join(dir, 'src/renderer/index.html'))).toContain('/src/main.ts');
  });

  it('builds a complete Svelte project', () => {
    const dir = path.join(tmp, 'svelte');
    scaffoldProject({ ...base, ui: 'svelte' }, dir);

    expect(fs.existsSync(path.join(dir, 'src/renderer/src/App.svelte'))).toBe(true);
    expect(fs.existsSync(path.join(dir, 'src/renderer/src/App.tsx'))).toBe(false);
    const pkg = JSON.parse(read(path.join(dir, 'package.json')));
    expect(pkg.dependencies.svelte).toBeTruthy();
    expect(pkg.dependencies.react).toBeUndefined();
    expect(read(path.join(dir, 'vite.config.ts'))).toContain('svelte()');
  });

  it('builds a complete vanilla project with no framework deps', () => {
    const dir = path.join(tmp, 'vanilla');
    scaffoldProject({ ...base, ui: 'vanilla' }, dir);

    expect(fs.existsSync(path.join(dir, 'src/renderer/src/main.ts'))).toBe(true);
    expect(fs.existsSync(path.join(dir, 'src/renderer/src/App.tsx'))).toBe(false);
    const pkg = JSON.parse(read(path.join(dir, 'package.json')));
    expect(Object.keys(pkg.dependencies)).toHaveLength(0);
    expect(read(path.join(dir, 'vite.config.ts'))).not.toContain('plugin-react');
    expect(read(path.join(dir, 'vite.config.ts'))).not.toContain('plugins: [');
  });

  it('keeps the template config valid JSON after patching', () => {
    for (const ui of ['vue', 'svelte', 'vanilla'] as const) {
      const dir = path.join(tmp, ui);
      scaffoldProject({ ...base, ui }, dir);
      expect(() => JSON.parse(read(path.join(dir, 'package.json')))).not.toThrow();
      expect(() => JSON.parse(read(path.join(dir, 'tsconfig.json')))).not.toThrow();
    }
  });
});

describe('CRLF checkouts (Windows runners, core.autocrlf=true)', () => {
  let tmp: string;
  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'winforge-crlf-'));
  });
  afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  /** Convert every text file in a scaffolded project to CRLF, like Git on Windows. */
  function toCrlf(dir: string): void {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        toCrlf(full);
      } else if (entry.isFile() && /\.(ts|tsx|html|json|css|md|js|cjs)$/.test(entry.name)) {
        const text = fs.readFileSync(full, 'utf8').replace(/\r\n/g, '\n').replace(/\n/g, '\r\n');
        fs.writeFileSync(full, text, 'utf8');
      }
    }
  }

  it.each(['vue', 'svelte', 'vanilla'] as const)(
    'applies the %s overlay to CRLF sources',
    (ui) => {
      const dir = path.join(tmp, ui);
      // Scaffold from a CRLF-converted copy of the templates, then re-scaffold
      // the same directory so the overlay patching runs against CRLF files.
      scaffoldProject({ ...base, ui: 'react' }, dir);
      toCrlf(dir);

      const cfgPath = path.join(dir, 'winforge.config.json');
      const vitePath = path.join(dir, 'vite.config.ts');
      expect(fs.readFileSync(cfgPath, 'utf8')).toContain('\r\n');

      // Apply the overlay the same way scaffoldProject does.
      patchPackageJson(dir, ui);
      patchIndexHtml(dir, ui);
      patchViteConfig(dir, ui);

      const vite = fs.readFileSync(vitePath, 'utf8');
      if (ui === 'vanilla') {
        expect(vite).not.toContain('plugin-react');
        expect(vite).not.toContain('plugins: [react()]');
      } else {
        expect(vite).toContain(`${ui}()`);
        expect(vite).not.toContain('plugins: [react()]');
      }
      // Line endings are preserved, not mixed.
      expect(vite).toContain('\r\n');
      expect(vite.replace(/\r\n/g, '')).not.toContain('\n');
      expect(fs.readFileSync(path.join(dir, 'src/renderer/index.html'), 'utf8')).toContain(
        '/src/main.ts',
      );
    },
  );
});
