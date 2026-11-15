/**
 * Pure helpers shared by the UI.
 * The web UI never executes anything — it only builds the exact command a
 * developer should copy into their terminal. All input is validated first.
 */
import type { PackageManager, TemplateKind, UiFramework } from './types.js';

export const TEMPLATE_LABELS: Record<TemplateKind, string> = {
  electron: 'Electron + React + TypeScript',
  tauri: 'Tauri + React + TypeScript',
};

export const UI_LABELS: Record<UiFramework, string> = {
  react: 'React',
  vue: 'Vue',
  svelte: 'Svelte',
  vanilla: 'Plain HTML/CSS/JS',
};

/**
 * Build the `winforge create` command for the chosen options.
 * Values are quoted defensively; nothing is executed by the browser.
 */
export function buildCreateCommand(opts: {
  projectName: string;
  template: TemplateKind;
  ui: UiFramework;
  pm: PackageManager;
  packageId: string;
}): string {
  const parts = [
    'winforge',
    'create',
    quote(opts.projectName),
    '--template',
    opts.template,
    '--ui',
    opts.ui,
    '--pm',
    opts.pm,
    '--package-id',
    quote(opts.packageId),
  ];
  return parts.join(' ');
}

/** Shell-quote a value only when it contains characters needing quotes. */
export function quote(value: string): string {
  return /^[A-Za-z0-9._/@-]+$/.test(value) ? value : `'${value.replace(/'/g, `'\\''`)}'`;
}

/** Mirrors the CLI's validator so the UI can show errors before copying. */
export function validateProjectName(name: string): string | null {
  if (!name) return 'Project name is required.';
  if (!/^[a-z][a-z0-9-_]*$/i.test(name)) {
    return 'Use letters, numbers, hyphens or underscores; must start with a letter.';
  }
  if (name.length < 2 || name.length > 64) return 'Project name must be 2–64 characters.';
  return null;
}

export function validatePackageId(id: string): string | null {
  if (!/^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*)+$/i.test(id)) {
    return 'Use a reverse-DNS identifier, e.g. com.example.myapp';
  }
  return null;
}

/** Which OS runners produce which artifacts (from the CLI capability matrix). */
export const TARGET_MATRIX = [
  {
    target: 'Windows',
    artifacts: '.exe (NSIS installer), portable .exe, optional .msi',
    localElectron: 'Yes — electron-builder + Wine (unsigned)',
    localTauri: 'No — Rust cannot cross-compile; needs windows-latest',
    ci: 'windows-latest',
  },
  {
    target: 'macOS',
    artifacts: '.dmg, .zip / .app',
    localElectron: 'Only on macOS',
    localTauri: 'Only on macOS',
    ci: 'macos-latest',
  },
  {
    target: 'Linux',
    artifacts: '.AppImage, .deb, .rpm',
    localElectron: 'Only on Linux (or Docker)',
    localTauri: 'Only on Linux',
    ci: 'ubuntu-latest',
  },
] as const;
