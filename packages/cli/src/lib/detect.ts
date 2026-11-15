/**
 * Host OS / architecture detection and build-capability matrix.
 *
 * Key fact (see docs/windows-builds.md):
 * - Electron (electron-builder) CAN cross-compile Windows NSIS/portable
 *   installers from macOS/Linux, but needs Wine for some targets and is
 *   slower / less reliable than a native Windows runner.
 * - Tauri (Rust) CANNOT cross-compile Windows binaries from macOS/Linux.
 *   Windows .exe/.msi MUST be built on a Windows runner (GitHub Actions
 *   `windows-latest` or a real Windows machine).
 */
import os from 'node:os';
import { execa } from 'execa';

export type HostOs = 'windows' | 'macos' | 'linux' | 'unknown';
export type HostArch = 'x64' | 'arm64' | 'unknown';

export interface HostInfo {
  os: HostOs;
  arch: HostArch;
  platform: string;
  release: string;
  cpus: number;
}

export function detectHost(): HostInfo {
  const platform = os.platform();
  const archRaw = os.arch();
  const osName: HostOs =
    platform === 'win32'
      ? 'windows'
      : platform === 'darwin'
        ? 'macos'
        : platform === 'linux'
          ? 'linux'
          : 'unknown';
  const arch: HostArch = archRaw === 'x64' ? 'x64' : archRaw === 'arm64' ? 'arm64' : 'unknown';
  return { os: osName, arch, platform, release: os.release(), cpus: os.cpus().length };
}

export interface TargetCapability {
  target: 'windows' | 'macos' | 'linux';
  canBuildLocally: boolean;
  method: string;
  notes: string;
}

export function buildCapabilities(
  host: HostInfo,
  template: 'electron' | 'tauri',
): TargetCapability[] {
  const caps: TargetCapability[] = [];

  // Windows
  if (host.os === 'windows') {
    caps.push({
      target: 'windows',
      canBuildLocally: true,
      method: 'Native build',
      notes: 'Full support: NSIS .exe, portable .exe, MSI (Tauri), signing.',
    });
  } else if (template === 'electron') {
    caps.push({
      target: 'windows',
      canBuildLocally: true,
      method: 'Cross-compile via electron-builder + Wine',
      notes:
        'Electron can cross-build Windows NSIS/portable from macOS/Linux. Install Wine for best results. For signed / MSI / production installers use GitHub Actions windows-latest.',
    });
  } else {
    caps.push({
      target: 'windows',
      canBuildLocally: false,
      method: 'GitHub Actions (windows-latest) required',
      notes:
        'Tauri/Rust cannot cross-compile Windows binaries from macOS/Linux. Run `winforge ci` and push to GitHub, or build on a Windows machine.',
    });
  }

  // macOS
  if (host.os === 'macos') {
    caps.push({
      target: 'macos',
      canBuildLocally: true,
      method: 'Native build',
      notes: 'Full support: .dmg, .app, notarization (with Apple credentials).',
    });
  } else if (host.os === 'linux' && template === 'electron') {
    caps.push({
      target: 'macos',
      canBuildLocally: false,
      method: 'GitHub Actions (macos-latest) required',
      notes: 'macOS .dmg requires Apple SDK / Xcode — only available on macOS runners.',
    });
  } else {
    caps.push({
      target: 'macos',
      canBuildLocally: false,
      method: 'GitHub Actions (macos-latest) required',
      notes: 'macOS .dmg requires Apple SDK / Xcode — only available on macOS runners.',
    });
  }

  // Linux
  if (host.os === 'linux') {
    caps.push({
      target: 'linux',
      canBuildLocally: true,
      method: 'Native build',
      notes: 'Full support: AppImage, .deb, .rpm (install dpkg/rpm tooling as needed).',
    });
  } else {
    caps.push({
      target: 'linux',
      canBuildLocally: false,
      method: 'GitHub Actions (ubuntu-latest) recommended',
      notes:
        'Linux packages can sometimes be built via Docker, but ubuntu-latest is the supported path.',
    });
  }

  return caps;
}

export async function commandExists(cmd: string): Promise<boolean> {
  try {
    await execa(cmd, ['--version'], { stdio: 'ignore' });
    return true;
  } catch {
    // Some tools don't support --version but still exist; try `which`-style check via execa.
    try {
      await execa('which', [cmd], { stdio: 'ignore' });
      return true;
    } catch {
      return false;
    }
  }
}

export async function getVersion(
  cmd: string,
  args: string[] = ['--version'],
): Promise<string | null> {
  try {
    const { stdout } = await execa(cmd, args, { stdio: 'pipe' });
    return stdout.split('\n')[0]?.trim() ?? null;
  } catch {
    return null;
  }
}
