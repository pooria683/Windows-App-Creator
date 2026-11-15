/**
 * winforge.config.ts / winforge.config.json handling for generated projects.
 * Generated projects include a `winforge.config.json` that the CLI reads
 * for `dev`, `build` and `package` commands.
 */
import fs from 'node:fs';
import path from 'node:path';
import type { PackageManager, TemplateKind, UiFramework } from './validate.js';
import {
  validateDisplayName,
  validatePackageId,
  validateProjectConfig,
  validateVersion,
} from './validate.js';

export interface WinForgeConfig {
  name: string;
  appName: string;
  packageId: string;
  version: string;
  author: string;
  description: string;
  template: TemplateKind;
  ui: UiFramework;
  packageManager: PackageManager;
  /** Optional signing config — signing is DISABLED by default. */
  signing?: {
    windows?: { enabled: boolean; certificateFile?: string; certificatePasswordEnv?: string };
    macos?: {
      enabled: boolean;
      identity?: string;
      appleIdEnv?: string;
      appleTeamIdEnv?: string;
      applePasswordEnv?: string;
    };
    linux?: { enabled: boolean; gpgKeyId?: string };
  };
}

const CONFIG_FILES = ['winforge.config.json', 'winforge.config.ts', 'winforge.config.js'];

export function findConfigFile(startDir: string): string | null {
  let dir = path.resolve(startDir);
  while (true) {
    for (const f of CONFIG_FILES) {
      const p = path.join(dir, f);
      if (fs.existsSync(p)) return p;
    }
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

export async function loadConfig(
  startDir: string,
): Promise<{ config: WinForgeConfig; configPath: string; projectRoot: string }> {
  const configPath = findConfigFile(startDir);
  if (!configPath) {
    throw new Error(
      'No winforge.config.json found. Run this command inside a WinForge project, or create one with `winforge create <name>`.',
    );
  }
  const projectRoot = path.dirname(configPath);
  let config: WinForgeConfig;
  if (configPath.endsWith('.json')) {
    config = JSON.parse(fs.readFileSync(configPath, 'utf8')) as WinForgeConfig;
  } else {
    // .ts/.js configs are loaded via dynamic import (requires tsx or compiled JS).
    const mod = (await import(configPath)) as { default?: WinForgeConfig } & WinForgeConfig;
    config = (mod.default ?? mod) as WinForgeConfig;
  }
  const errors = validateLoadedConfig(config);
  if (errors.length > 0) {
    throw new Error(`Invalid ${path.basename(configPath)}:\n  - ${errors.join('\n  - ')}`);
  }

  return { config, configPath, projectRoot };
}

/**
 * Validate a loaded winforge.config.json. Runs on every command so a
 * hand-edited config can't quietly produce a broken build.
 */
export function validateLoadedConfig(config: WinForgeConfig): string[] {
  const errors = validateProjectConfig(config);
  if (!config.appName) errors.push('appName: is required.');
  else {
    const r = validateDisplayName(config.appName);
    if (r !== true) errors.push(`appName: ${r}`);
  }
  if (!config.version) errors.push('version: is required.');
  else {
    const r = validateVersion(config.version);
    if (r !== true) errors.push(`version: ${r}`);
  }
  if (!config.packageId) errors.push('packageId: is required.');
  else {
    const r = validatePackageId(config.packageId);
    if (r !== true) errors.push(`packageId: ${r}`);
  }
  if (!config.template) errors.push('template: is required (electron | tauri).');
  return errors;
}

export function defaultConfig(partial: Partial<WinForgeConfig>): WinForgeConfig {
  return {
    name: partial.name ?? 'my-app',
    appName: partial.appName ?? partial.name ?? 'my-app',
    packageId: partial.packageId ?? 'com.example.myapp',
    version: partial.version ?? '0.1.0',
    author: partial.author ?? 'Your Name',
    description: partial.description ?? 'A desktop app built with WinForge.',
    template: partial.template ?? 'electron',
    ui: partial.ui ?? 'react',
    packageManager: partial.packageManager ?? 'npm',
    signing: {
      windows: { enabled: false },
      macos: { enabled: false },
      linux: { enabled: false },
    },
  };
}
