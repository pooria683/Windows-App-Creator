/**
 * Non-React renderer overlays.
 *
 * The React templates are the fully-wired baseline. Choosing Vue, Svelte or
 * vanilla applies a small overlay instead of leaving a half-React project:
 *
 *   renderers/<ui>/files/**      → copied over the scaffolded project
 *   renderers/<ui>/package.json  → dependency/script patches merged in
 *
 * The Electron/Tauri shell (main process, preload, IPC, build config) is
 * unchanged — only the renderer entry and its toolchain differ.
 */
import fs from 'node:fs';
import path from 'node:path';
import type { UiFramework } from './validate.js';

type Json = Record<string, unknown>;

export interface RendererOverlayPatch {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  scripts?: Record<string, string>;
  /** Files to delete from the scaffolded project (relative paths). */
  remove?: string[];
  /** npm packages to drop from the scaffolded project. */
  removeDependencies?: string[];
  /** Drop the React/Vite React plugin from devDependencies and config. */
  removeReactTooling?: boolean;
  /** Extra config merged into vite.config.ts via a generated snippet. */
  vitePluginImport?: string;
  vitePlugins?: string;
}

const OVERLAYS: Record<Exclude<UiFramework, 'react'>, RendererOverlayPatch> = {
  vue: {
    dependencies: { vue: '^3.5.13' },
    devDependencies: { '@vitejs/plugin-vue': '^5.2.1', 'vue-tsc': '^2.1.10' },
    scripts: {
      build: 'npm run build:web && npm run build:main && electron-builder',
      typecheck: 'vue-tsc --noEmit',
    },
    remove: ['src/renderer/src/App.tsx', 'src/renderer/src/main.tsx'],
    removeDependencies: ['react', 'react-dom', '@types/react', '@types/react-dom'],
    removeReactTooling: true,
    vitePluginImport: "import vue from '@vitejs/plugin-vue';",
    vitePlugins: 'vue()',
  },
  svelte: {
    dependencies: { svelte: '^5.19.0' },
    devDependencies: {
      // plugin-svelte v4 targets Svelte 5 + Vite 5 (the template baseline);
      // plugin v5+ requires Vite 6.
      '@sveltejs/vite-plugin-svelte': '^4.0.4',
      'svelte-check': '^4.1.4',
    },
    scripts: {
      build: 'npm run build:web && npm run build:main && electron-builder',
      typecheck: 'svelte-check --tsconfig ./tsconfig.json',
    },
    remove: ['src/renderer/src/App.tsx', 'src/renderer/src/main.tsx'],
    removeDependencies: ['react', 'react-dom', '@types/react', '@types/react-dom'],
    removeReactTooling: true,
    vitePluginImport: "import { svelte } from '@sveltejs/vite-plugin-svelte';",
    vitePlugins: 'svelte()',
  },
  vanilla: {
    remove: ['src/renderer/src/App.tsx', 'src/renderer/src/main.tsx'],
    removeDependencies: ['react', 'react-dom', '@types/react', '@types/react-dom'],
    removeReactTooling: true,
  },
};

export function getRendererOverlay(ui: UiFramework): RendererOverlayPatch | null {
  if (ui === 'react') return null;
  return OVERLAYS[ui];
}

/** Copy overlay files (with token rendering) over the project. */
export function applyRendererOverlay(
  ui: UiFramework,
  overlaysRoot: string,
  destDir: string,
  renderTokens: (text: string) => string,
): string[] {
  if (ui === 'react') return [];
  const filesRoot = path.join(overlaysRoot, ui, 'files');
  if (!fs.existsSync(filesRoot)) return [];

  const written: string[] = [];
  const walk = (src: string, rel: string): void => {
    for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
      const srcPath = path.join(src, entry.name);
      const relPath = rel ? path.join(rel, entry.name) : entry.name;
      if (entry.isDirectory()) {
        walk(srcPath, relPath);
      } else if (entry.isFile()) {
        const destPath = path.join(destDir, relPath);
        fs.mkdirSync(path.dirname(destPath), { recursive: true });
        fs.writeFileSync(destPath, renderTokens(fs.readFileSync(srcPath, 'utf8')), 'utf8');
        written.push(relPath);
      }
    }
  };
  walk(filesRoot, '');
  return written;
}

/**
 * Point index.html at the overlay's renderer entry.
 * The React templates use `/src/main.tsx`; every overlay uses `/src/main.ts`
 * or a framework-specific entry.
 */
export function patchIndexHtml(destDir: string, ui: UiFramework): void {
  if (ui === 'react') return;
  const htmlPath = path.join(destDir, 'src/renderer/index.html');
  if (!fs.existsSync(htmlPath)) return;
  const html = fs
    .readFileSync(htmlPath, 'utf8')
    .replace(/(<script[^>]*src=")[^"]*(")/, `$1/src/main.ts$2`);
  fs.writeFileSync(htmlPath, html, 'utf8');
}

/** Apply dependency/script/removal patches to the scaffolded package.json. */
export function patchPackageJson(destDir: string, ui: UiFramework): void {
  const overlay = getRendererOverlay(ui);
  if (!overlay) return;
  const pkgPath = path.join(destDir, 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8')) as Json & {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
    scripts?: Record<string, string>;
  };

  pkg.dependencies = { ...(pkg.dependencies ?? {}), ...(overlay.dependencies ?? {}) };
  pkg.devDependencies = { ...(pkg.devDependencies ?? {}), ...(overlay.devDependencies ?? {}) };
  pkg.scripts = { ...(pkg.scripts ?? {}), ...(overlay.scripts ?? {}) };

  // Remove framework-specific leftovers (React entry files and packages).
  for (const rel of overlay.remove ?? []) {
    fs.rmSync(path.join(destDir, rel), { force: true });
  }
  for (const dep of overlay.removeDependencies ?? []) {
    delete pkg.dependencies?.[dep];
    delete pkg.devDependencies?.[dep];
  }
  if (overlay.removeReactTooling) {
    delete pkg.devDependencies?.['@vitejs/plugin-react'];
  }

  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8');
}

/**
 * Rewrite vite.config.ts so the correct framework plugin is registered.
 * Done textually (not via AST) because the template's config is small and
 * the substitution is exact — no user input reaches this function.
 */
export function patchViteConfig(destDir: string, ui: UiFramework): void {
  const overlay = getRendererOverlay(ui);
  if (!overlay) return;
  const cfgPath = path.join(destDir, 'vite.config.ts');
  if (!fs.existsSync(cfgPath)) return;

  let cfg = fs.readFileSync(cfgPath, 'utf8');
  cfg = cfg.replace(
    "import react from '@vitejs/plugin-react';",
    overlay.vitePluginImport ?? "import react from '@vitejs/plugin-react';",
  );
  if (overlay.vitePlugins) {
    cfg = cfg.replace('plugins: [react()]', `plugins: [${overlay.vitePlugins}]`);
  } else {
    // Vanilla TS needs no framework plugin — drop the line cleanly.
    cfg = cfg.replace("import react from '@vitejs/plugin-react';\n", '');
    cfg = cfg.replace('  plugins: [react()],\n', '');
  }
  // Svelte single-file components need the svelte extension in the build.
  if (ui === 'svelte') {
    cfg = cfg.replace(
      'build: {',
      'build: {\n    // .svelte components are handled by @sveltejs/vite-plugin-svelte.\n',
    );
  }
  fs.writeFileSync(cfgPath, cfg, 'utf8');
}

/** Extend tsconfig include patterns for .vue/.svelte files. */
export function patchTsconfig(destDir: string, ui: UiFramework): void {
  if (ui === 'react') return;
  const tsPath = path.join(destDir, 'tsconfig.json');
  if (!fs.existsSync(tsPath)) return;
  const cfg = JSON.parse(fs.readFileSync(tsPath, 'utf8')) as Json;
  if (ui === 'svelte') {
    cfg['compilerOptions'] = {
      ...(cfg['compilerOptions'] as Json),
      moduleResolution: 'bundler',
      allowJs: true,
      checkJs: true,
    };
  }
  fs.writeFileSync(tsPath, JSON.stringify(cfg, null, 2) + '\n', 'utf8');
}
