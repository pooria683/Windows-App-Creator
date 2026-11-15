/**
 * @winforge/templates — template registry.
 * Templates are plain directories; this module exposes metadata so the
 * CLI and web UI can list them without hardcoding paths in multiple places.
 */
export interface TemplateInfo {
  id: 'electron' | 'tauri';
  dir: string;
  title: string;
  description: string;
  defaultUi: 'react';
  windowsTargets: string[];
  macosTargets: string[];
  linuxTargets: string[];
}

export const TEMPLATES: TemplateInfo[] = [
  {
    id: 'electron',
    dir: 'electron-react-ts',
    title: 'Electron + React + TypeScript',
    description:
      'Chromium + Node.js desktop app. Secure preload/contextBridge, electron-builder NSIS/portable.',
    defaultUi: 'react',
    windowsTargets: ['nsis (.exe installer)', 'portable (.exe)', 'msi (optional, via WiX)'],
    macosTargets: ['dmg', 'zip'],
    linuxTargets: ['AppImage', 'deb', 'rpm'],
  },
  {
    id: 'tauri',
    dir: 'tauri-react-ts',
    title: 'Tauri + React + TypeScript',
    description:
      'Rust + system WebView. Small binaries, NSIS + MSI on Windows (built on windows-latest).',
    defaultUi: 'react',
    windowsTargets: ['nsis (.exe installer)', 'msi (.msi via WiX)'],
    macosTargets: ['dmg', 'app'],
    linuxTargets: ['AppImage', 'deb', 'rpm'],
  },
];

export function getTemplate(id: string): TemplateInfo | undefined {
  return TEMPLATES.find((t) => t.id === id);
}
