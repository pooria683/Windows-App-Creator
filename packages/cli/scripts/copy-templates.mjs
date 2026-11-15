#!/usr/bin/env node
/**
 * Copies the workspace templates into the CLI package so a published
 * `@winforge/cli` tarball is self-contained. Run as part of `npm run build`.
 * Generated output is git-ignored (packages/cli/templates).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const cliRoot = path.resolve(here, '..');
const repoRoot = path.resolve(cliRoot, '../..');
const srcRoot = path.join(repoRoot, 'packages/templates');
const destRoot = path.join(cliRoot, 'templates');
const dirs = ['electron-react-ts', 'tauri-react-ts', 'renderers', 'github-actions'];

fs.rmSync(destRoot, { recursive: true, force: true });
for (const dir of dirs) {
  const src = path.join(srcRoot, dir);
  if (!fs.existsSync(src)) {
    console.warn(`[copy-templates] skipped missing template: ${dir}`);
    continue;
  }
  fs.cpSync(src, path.join(destRoot, dir), { recursive: true });
}
console.log(`[copy-templates] copied ${dirs.length} template dirs -> packages/cli/templates`);
