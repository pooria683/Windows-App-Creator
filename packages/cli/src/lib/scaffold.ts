/**
 * Template scaffolding — copies a template directory into a new project
 * and substitutes {{TOKENS}} with user-provided values.
 *
 * Templates live in `packages/templates/<template>-react-ts/` relative to
 * this file (in dev) or in the installed package (in production).
 * Token replacement is intentionally simple and auditable: no eval, no
 * arbitrary code execution from template files.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ProjectConfig } from './validate.js';
import { toProductNameFromDisplay } from './validate.js';
import {
  applyRendererOverlay,
  patchIndexHtml,
  patchPackageJson,
  patchTsconfig,
  patchViteConfig,
} from './renderers.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export interface ScaffoldOptions {
  /** Absolute path to the templates root (contains electron-react-ts/, tauri-react-ts/). */
  templatesRoot?: string;
  /** Skip token replacement for binary files (default true). */
  skipBinary?: boolean;
}

/**
 * Locate the templates root. Checked in order:
 *   1. explicit option
 *   2. packages/templates next to the compiled CLI (monorepo / dev)
 *   3. templates/ inside the CLI package (published tarball)
 *   4. ./packages/templates in the current working directory
 */
export function resolveTemplatesRoot(explicit?: string): string {
  if (explicit) return path.resolve(explicit);
  const candidates = [
    path.resolve(__dirname, '../../../templates'),
    path.resolve(__dirname, '../../templates'),
    path.resolve(__dirname, '../templates'),
    path.resolve(process.cwd(), 'packages/templates'),
  ];
  for (const c of candidates) {
    if (fs.existsSync(path.join(c, 'electron-react-ts'))) return c;
  }
  return candidates[0]!;
}

export function templateDirName(cfg: Pick<ProjectConfig, 'template'>): string {
  // React is the fully-maintained baseline shell; other UIs are applied as
  // renderer overlays on top of it (see lib/renderers.ts).
  return `${cfg.template}-react-ts`;
}

export function buildTokens(cfg: ProjectConfig): Record<string, string> {
  const productName = toProductNameFromDisplay(cfg.appName, cfg.name);
  return {
    APP_NAME: cfg.name,
    APP_DISPLAY_NAME: cfg.appName,
    PRODUCT_NAME: productName,
    PACKAGE_ID: cfg.packageId,
    VERSION: cfg.version,
    AUTHOR: cfg.author,
    DESCRIPTION: cfg.description,
    TEMPLATE: cfg.template,
    UI_FRAMEWORK: cfg.ui,
    PACKAGE_MANAGER: cfg.packageManager,
    YEAR: String(new Date().getFullYear()),
  };
}

const BINARY_EXTS = new Set([
  '.png',
  '.ico',
  '.icns',
  '.jpg',
  '.jpeg',
  '.gif',
  '.woff',
  '.woff2',
  '.ttf',
  '.eot',
  '.zip',
  '.gz',
]);

export function renderTokens(content: string, tokens: Record<string, string>): string {
  return content.replace(/\{\{([A-Z_]+)\}\}/g, (match, key: string) => tokens[key] ?? match);
}

/**
 * Copy template -> dest, replacing tokens. Idempotent: re-running produces
 * the same files and content (existing files are overwritten). Callers are
 * expected to guard against non-empty directories unless --force is given.
 */
export function scaffoldProject(
  cfg: ProjectConfig,
  destDir: string,
  opts: ScaffoldOptions = {},
): string[] {
  const templatesRoot = resolveTemplatesRoot(opts.templatesRoot);
  const srcDir = path.join(templatesRoot, templateDirName(cfg));
  if (!fs.existsSync(srcDir)) {
    throw new Error(
      `Template not found: ${srcDir}. Is @winforge/templates installed? ` +
        'Pass --templates-root <path> to point at a custom templates directory.',
    );
  }
  const tokens = buildTokens(cfg);
  const written: string[] = [];

  const walk = (src: string, rel: string): void => {
    for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
      const srcPath = path.join(src, entry.name);
      const relPath = rel ? path.join(rel, entry.name) : entry.name;
      const destPath = path.join(destDir, relPath);
      if (entry.isDirectory()) {
        fs.mkdirSync(destPath, { recursive: true });
        walk(srcPath, relPath);
      } else if (entry.isFile()) {
        fs.mkdirSync(path.dirname(destPath), { recursive: true });
        const ext = path.extname(entry.name).toLowerCase();
        if (BINARY_EXTS.has(ext)) {
          fs.copyFileSync(srcPath, destPath);
        } else {
          const raw = fs.readFileSync(srcPath, 'utf8');
          fs.writeFileSync(destPath, renderTokens(raw, tokens), 'utf8');
        }
        written.push(relPath);
      }
    }
  };

  fs.mkdirSync(destDir, { recursive: true });
  walk(srcDir, '');

  // Non-React UIs: overlay a complete, working renderer (files + deps +
  // build config), rather than leaving a half-React project behind.
  if (cfg.ui !== 'react') {
    const overlays = applyRendererOverlay(
      cfg.ui,
      path.join(templatesRoot, 'renderers'),
      destDir,
      (text) => renderTokens(text, tokens),
    );
    written.push(...overlays);
    patchIndexHtml(destDir, cfg.ui);
    patchPackageJson(destDir, cfg.ui);
    patchViteConfig(destDir, cfg.ui);
    patchTsconfig(destDir, cfg.ui);
  }

  // Machine-readable project config consumed by `dev`, `build`, `package`
  // and `ci`. Signing is DISABLED until the developer supplies certificates.
  const configPath = path.join(destDir, 'winforge.config.json');
  fs.writeFileSync(
    configPath,
    JSON.stringify(
      {
        $schema:
          'https://raw.githubusercontent.com/pooria683/Windows-App-Creator/main/schema/winforge.config.schema.json',
        name: cfg.name,
        appName: cfg.appName,
        packageId: cfg.packageId,
        version: cfg.version,
        author: cfg.author,
        description: cfg.description,
        template: cfg.template,
        ui: cfg.ui,
        packageManager: cfg.packageManager,
        signing: {
          windows: { enabled: false },
          macos: { enabled: false },
          linux: { enabled: false },
        },
      },
      null,
      2,
    ) + '\n',
    'utf8',
  );
  written.push('winforge.config.json');

  return written;
}
