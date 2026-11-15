/**
 * Input validation for WinForge project scaffolding.
 * All user input is validated before any file is written.
 */
import semver from 'semver';

export type TemplateKind = 'electron' | 'tauri';
export type UiFramework = 'react' | 'vue' | 'svelte' | 'vanilla';
export type PackageManager = 'npm' | 'pnpm' | 'yarn' | 'bun';
export type BuildTarget = 'windows' | 'macos' | 'linux' | 'all';
export type PackageFormat = 'exe' | 'msi' | 'dmg' | 'appimage' | 'deb' | 'rpm';

export interface ProjectConfig {
  name: string;
  appName: string;
  packageId: string;
  version: string;
  author: string;
  description: string;
  template: TemplateKind;
  ui: UiFramework;
  packageManager: PackageManager;
}

const APP_NAME_RE = /^[a-z][a-z0-9-_]*$/i;
/** Windows reserved device names (case-insensitive, also reserved with an extension). */
const WINDOWS_RESERVED_DEVICE = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;
const PACKAGE_ID_RE = /^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*)+$/i;

export function validateAppName(name: string): string | true {
  if (!name || typeof name !== 'string') return 'App name is required.';
  if (name.length < 2 || name.length > 64) return 'App name must be 2–64 characters.';
  if (!APP_NAME_RE.test(name)) {
    return 'App name must start with a letter and contain only letters, numbers, hyphens or underscores.';
  }
  const reserved = ['node_modules', 'dist', 'build', 'out', 'release', 'src-tauri'];
  const lower = name.toLowerCase();
  if (reserved.includes(lower)) return `"${name}" is a reserved name.`;
  // Windows cannot create files/directories with these device names, so a
  // project called "con" would fail on a Windows checkout or CI runner.
  if (WINDOWS_RESERVED_DEVICE.test(lower)) {
    return `"${name}" is a reserved Windows device name (CON, PRN, AUX, NUL, COM1-9, LPT1-9).`;
  }
  return true;
}

export function validatePackageId(id: string): string | true {
  if (!id || typeof id !== 'string') return 'Package identifier is required.';
  if (id.length > 128) return 'Package identifier must be ≤ 128 characters.';
  if (!PACKAGE_ID_RE.test(id)) {
    return 'Package identifier must be reverse-DNS, e.g. com.example.myapp (lowercase letters, numbers, dots).';
  }
  return true;
}

export function validateVersion(v: string): string | true {
  if (!v || typeof v !== 'string') return 'Version is required.';
  // semver.valid() coerces a leading "v" (returns "1.0.0"), so reject it
  // explicitly: package.json / tauri.conf.json need the bare version.
  if (/^[vV]/.test(v) || !semver.valid(v)) {
    return 'Version must be valid semantic versioning, e.g. 1.0.0 (no leading "v").';
  }
  return true;
}

export function validateAuthor(a: string): string | true {
  if (!a || typeof a !== 'string' || !a.trim()) return 'Author/publisher is required.';
  if (a.length > 120) return 'Author must be ≤ 120 characters.';
  if (/[<>"'`;|&$`]/.test(a)) return 'Author contains characters that are not allowed.';
  return true;
}

export function validateDescription(d: string): string | true {
  if (d === undefined || d === null) return 'Description is required.';
  if (d.length > 280) return 'Description must be ≤ 280 characters.';
  return true;
}

export function validateProjectConfig(cfg: Partial<ProjectConfig>): string[] {
  const errors: string[] = [];
  const check = (r: string | true, field: string): void => {
    if (r !== true) errors.push(`${field}: ${r}`);
  };
  if (cfg.name !== undefined) check(validateAppName(cfg.name), 'name');
  if (cfg.appName !== undefined) check(validateDisplayName(cfg.appName), 'appName');
  if (cfg.packageId !== undefined) check(validatePackageId(cfg.packageId), 'packageId');
  if (cfg.version !== undefined) check(validateVersion(cfg.version), 'version');
  if (cfg.author !== undefined) check(validateAuthor(cfg.author), 'author');
  if (cfg.description !== undefined) check(validateDescription(cfg.description), 'description');
  if (cfg.template !== undefined && !['electron', 'tauri'].includes(cfg.template)) {
    errors.push('template: must be "electron" or "tauri".');
  }
  if (cfg.ui !== undefined && !['react', 'vue', 'svelte', 'vanilla'].includes(cfg.ui)) {
    errors.push('ui: must be "react", "vue", "svelte" or "vanilla".');
  }
  if (
    cfg.packageManager !== undefined &&
    !['npm', 'pnpm', 'yarn', 'bun'].includes(cfg.packageManager)
  ) {
    errors.push('packageManager: must be "npm", "pnpm", "yarn" or "bun".');
  }
  return errors;
}

/**
 * Display names are human-readable ("Hello WinForge"), so they are checked
 * more permissively than slugs: printable text, no path separators or
 * control characters, no shell/template metacharacters that would corrupt
 * generated JSON/YAML/shell output.
 */
export function validateDisplayName(name: string): string | true {
  if (!name || typeof name !== 'string' || !name.trim()) return 'App display name is required.';
  if (name.length > 80) return 'App display name must be ≤ 80 characters.';
  // eslint-disable-next-line no-control-regex
  if (/[<>"'`$\\{}|;&/\\:*?\u0000-\u001f]/.test(name)) {
    return 'App display name contains characters that are not allowed.';
  }
  return true;
}

/** Convert a display name like "My Cool App" to a safe slug like "my-cool-app". */
export function toSlug(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
}

/**
 * Product name used for installer/file names: the project slug in PascalCase.
 * Derived from the slug (never the display name) so Windows/macOS artifact
 * names stay free of spaces and shell-special characters.
 */
export function toProductNameFromDisplay(display: string, slugFallback: string): string {
  const fromDisplay = display
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join('');
  return fromDisplay || toProductName(slugFallback);
}

/** Convert a slug to a PascalCase product name, e.g. "my-cool-app" -> "MyCoolApp". */
export function toProductName(slug: string): string {
  return (
    slug
      .split(/[-_]+/)
      .filter(Boolean)
      .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
      .join('') || 'WinForgeApp'
  );
}
