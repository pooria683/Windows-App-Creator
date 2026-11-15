/**
 * `winforge ci`
 * Generates a GitHub Actions workflow that builds Windows, macOS and
 * Linux artifacts on native runners and uploads them. With `--release`,
 * a final job attaches the artifacts to a GitHub Release on version tags.
 *
 * Why CI is required for some targets (see docs/windows-builds.md):
 * - Tauri (Rust) cannot cross-compile Windows binaries from macOS/Linux,
 *   so `.exe`/`.msi` must be built on windows-latest.
 * - Signed Windows installers and notarized macOS `.dmg` require the
 *   native OS toolchains.
 * - Electron *can* cross-build unsigned NSIS/portable from macOS/Linux,
 *   but CI gives reproducible, native, signable builds for all three OSes.
 *
 * Signing is DISABLED by default. Secrets are only wired in when the
 * workflow is generated with `--signing`, and are never hardcoded.
 */
import fs from 'node:fs';
import path from 'node:path';
import { Command } from 'commander';
import { log } from '../lib/logger.js';
import { loadConfig } from '../lib/config.js';

export interface WorkflowOptions {
  appName: string;
  template: string;
  packageManager: string;
  release: boolean;
  /** Wire signing secrets into the build steps (off by default). */
  signing?: boolean;
  /** Also build an MSI on Windows (Electron: WiX; Tauri: WiX). */
  msi?: boolean;
}

/** Package-manager specific install steps (2-space YAML style, 6-space indent). */
function installSteps(pm: string): string[] {
  switch (pm) {
    case 'pnpm':
      return [
        '      - uses: pnpm/action-setup@v4',
        '        with:',
        '          version: 9',
        '      - uses: actions/setup-node@v4',
        '        with:',
        '          node-version: 20',
        '      - run: pnpm install --frozen-lockfile',
      ];
    case 'yarn':
      return [
        '      - uses: actions/setup-node@v4',
        '        with:',
        '          node-version: 20',
        '      - run: yarn install --frozen-lockfile',
      ];
    case 'bun':
      return [
        '      - uses: oven-sh/setup-bun@v2',
        '        with:',
        '          bun-version: latest',
        '      - run: bun install --frozen-lockfile',
      ];
    default:
      return [
        '      - uses: actions/setup-node@v4',
        '        with:',
        '          node-version: 20',
        '      - run: npm ci || npm install',
      ];
  }
}

/** How to run the project's build script with the chosen package manager. */
function runCmd(pm: string, script: string): string {
  if (pm === 'yarn') return `yarn ${script}`;
  if (pm === 'pnpm') return `pnpm run ${script}`;
  if (pm === 'bun') return `bun run ${script}`;
  return `npm run ${script}`;
}

/** electron-builder output directory (see template package.json → build.directories). */
const ELECTRON_ARTIFACTS = 'release/*';
/** Tauri output directory (src-tauri/target/release/bundle). */
const TAURI_ARTIFACTS = 'src-tauri/target/release/bundle/**/*';

/** electron-builder CLI flags per OS (unsigned unless signing secrets are set). */
function electronTarget(os: 'windows' | 'macos' | 'linux', msi: boolean): string {
  const base = `npx electron-builder --${os === 'windows' ? 'win' : os === 'macos' ? 'mac' : 'linux'}`;
  if (os === 'windows') return `${base} nsis portable${msi ? ' msi' : ''} --publish never`;
  if (os === 'macos') return `${base} dmg zip --publish never`;
  return `${base} AppImage deb rpm --publish never`;
}

function tauriTarget(os: 'windows' | 'macos' | 'linux', msi: boolean): string {
  if (os === 'windows') return `tauri build --bundles nsis${msi ? ',msi' : ''}`;
  if (os === 'macos') return 'tauri build --bundles dmg';
  return 'tauri build --bundles appimage,deb,rpm';
}

interface OsJobSpec {
  os: 'windows' | 'macos' | 'linux';
  runner: string;
  title: string;
}

const OS_JOBS: OsJobSpec[] = [
  { os: 'windows', runner: 'windows-latest', title: 'Windows (.exe installer / portable)' },
  { os: 'macos', runner: 'macos-latest', title: 'macOS (.dmg)' },
  { os: 'linux', runner: 'ubuntu-latest', title: 'Linux (.AppImage / .deb / .rpm)' },
];

function renderEnvBlock(opts: WorkflowOptions, os: 'windows' | 'macos' | 'linux'): string[] {
  if (!opts.signing) return [];
  if (opts.template === 'tauri') {
    return [
      '        env:',
      '          # Updater signing — set the repo secrets listed in docs/signing.md.',
      '          TAURI_SIGNING_PRIVATE_KEY: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY }}',
      '          TAURI_SIGNING_PRIVATE_KEY_PASSWORD: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY_PASSWORD }}',
      '          TAURI_WINDOWS_CERTIFICATE_THUMBPRINT: ${{ secrets.WINDOWS_CERTIFICATE_THUMBPRINT }}',
    ];
  }
  if (os === 'windows') {
    return [
      '        env:',
      '          # Windows Authenticode — requires a .pfx stored in repo secrets.',
      '          WIN_CSC_LINK: ${{ secrets.WIN_CSC_LINK }}',
      '          WIN_CSC_KEY_PASSWORD: ${{ secrets.WIN_CSC_KEY_PASSWORD }}',
    ];
  }
  if (os === 'macos') {
    return [
      '        env:',
      '          # macOS signing + notarization — requires an Apple developer account.',
      '          CSC_LINK: ${{ secrets.MAC_CSC_LINK }}',
      '          CSC_KEY_PASSWORD: ${{ secrets.MAC_CSC_KEY_PASSWORD }}',
      '          APPLE_ID: ${{ secrets.APPLE_ID }}',
      '          APPLE_APP_SPECIFIC_PASSWORD: ${{ secrets.APPLE_APP_SPECIFIC_PASSWORD }}',
      '          APPLE_TEAM_ID: ${{ secrets.APPLE_TEAM_ID }}',
    ];
  }
  // Linux package signing is done with GPG outside electron-builder
  // (e.g. `gpg --detach-sign` on .deb/.rpm/.AppImage) — see docs/signing.md.
  return [];
}

function renderJob(spec: OsJobSpec, opts: WorkflowOptions): string {
  const isTauri = opts.template === 'tauri';
  const lines: string[] = [];
  lines.push(`  build-${spec.os}:`);
  lines.push(`    name: ${spec.title}`);
  lines.push(`    runs-on: ${spec.runner}`);
  lines.push('    steps:');
  lines.push('      - uses: actions/checkout@v4');
  lines.push(...installSteps(opts.packageManager));

  if (isTauri) {
    lines.push('      - name: Install Rust (stable)');
    lines.push('        uses: dtolnay/rust-toolchain@stable');
    lines.push('      - name: Cache Rust build');
    lines.push('        uses: Swatinem/rust-cache@v2');
    lines.push('        with:');
    lines.push('          workspaces: src-tauri');
    if (spec.os === 'linux') {
      lines.push('      - name: Install Tauri Linux dependencies');
      lines.push('        run: |');
      lines.push('          sudo apt-get update');
      lines.push('          sudo apt-get install -y \\');
      lines.push('            libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev \\');
      lines.push('            patchelf rpm');
    }
    // Tauri builds only for the runner's own OS/arch — no cross-compilation.
    // `npx tauri` resolves the project-local @tauri-apps/cli binary.
    lines.push(`      - name: Build + bundle (${spec.os})`);
    lines.push(`        run: npx ${tauriTarget(spec.os, Boolean(opts.msi))}`);
    lines.push(...renderEnvBlock(opts, spec.os));
  } else {
    // electron-builder needs the renderer + main bundles first; build them with
    // the project's own scripts so the chosen package manager is respected.
    lines.push(`      - name: Build renderer + main (${spec.os})`);
    lines.push('        run: |');
    lines.push(`          ${runCmd(opts.packageManager, 'build:web')}`);
    lines.push(`          ${runCmd(opts.packageManager, 'build:main')}`);
    lines.push(`      - name: Package (${spec.os})`);
    lines.push(`        run: ${electronTarget(spec.os, Boolean(opts.msi))}`);
    lines.push(...renderEnvBlock(opts, spec.os));
    lines.push('      - name: Generate checksums');
    lines.push('        shell: bash');
    lines.push('        run: |');
    lines.push('          cd release');
    lines.push('          sha_cmd="sha256sum"');
    lines.push('          command -v sha256sum >/dev/null 2>&1 || sha_cmd="shasum -a 256"');
    lines.push('          for f in *; do');
    lines.push('            case "$f" in *.yml|*.blockmap|*.json|SHA256SUMS.txt) continue;; esac');
    lines.push('            if [ -f "$f" ]; then $sha_cmd "$f" >> SHA256SUMS.txt; fi');
    lines.push('          done');
    lines.push('          exit 0');
  }

  lines.push('      - name: Upload artifacts');
  lines.push('        uses: actions/upload-artifact@v4');
  lines.push('        with:');
  lines.push(`          name: ${opts.template}-${spec.os}-${'$'}{{ github.sha }}`);
  lines.push('          path: |');
  lines.push(`            ${isTauri ? TAURI_ARTIFACTS : ELECTRON_ARTIFACTS}`);
  lines.push('            !**/*.blockmap');
  lines.push('          if-no-files-found: error');
  lines.push('          retention-days: 14');
  return lines.join('\n');
}

function renderReleaseJob(): string {
  return `  # Attaches the artifacts to a DRAFT GitHub Release on v* tags.
  # Draft + manual review is deliberate: verify installers before publishing,
  # and note that unsigned builds will trigger SmartScreen / Gatekeeper.
  release:
    name: Publish GitHub Release
    needs: [build-windows, build-macos, build-linux]
    if: startsWith(github.ref, 'refs/tags/v')
    runs-on: ubuntu-latest
    permissions:
      contents: write
    steps:
      - uses: actions/download-artifact@v4
        with:
          path: artifacts
          merge-multiple: true
      - name: Create release
        uses: softprops/action-gh-release@v2
        with:
          draft: true
          generate_release_notes: true
          files: |
            artifacts/**/*.exe
            artifacts/**/*.msi
            artifacts/**/*.dmg
            artifacts/**/*.zip
            artifacts/**/*.AppImage
            artifacts/**/*.deb
            artifacts/**/*.rpm
            artifacts/**/SHA256SUMS.txt
`;
}

export function renderWorkflow(opts: WorkflowOptions): string {
  const isTauri = opts.template === 'tauri';
  const header = `# WinForge-generated GitHub Actions workflow.
# Builds Windows (.exe${opts.msi ? ' / .msi' : ''}), macOS (.dmg) and Linux
# (.AppImage/.deb/.rpm) on native runners: windows-latest, macos-latest,
# ubuntu-latest. Artifacts are uploaded to the workflow run and, on tags
# (v*), attached to a draft GitHub Release.
#
# Generated by: winforge ci
# App: ${opts.appName}
# Template: ${opts.template}
# Package manager: ${opts.packageManager}
# Signing: ${opts.signing ? 'ENABLED via repo secrets (see docs/signing.md)' : 'DISABLED (unsigned builds)'}
#
# NOTE: unsigned installers are NOT production-ready. Users will see
# SmartScreen / Gatekeeper warnings. See docs/signing.md.

name: Build desktop apps

on:
  push:
    branches: [main]
    tags: ['v*']
  pull_request:
  workflow_dispatch:

permissions:
  contents: read

concurrency:
  group: \${{ github.workflow }}-\${{ github.ref }}
  cancel-in-progress: true

jobs:
`;

  const jobs = OS_JOBS.map((spec) => renderJob(spec, opts)).join('\n\n');
  const release = opts.release ? '\n\n' + renderReleaseJob() : '';

  const trailer = isTauri
    ? `
#
# Tauri note: Windows bundles are built on windows-latest because Rust
# cannot cross-compile Windows binaries from macOS/Linux. Linux bundles
# need the webkit2gtk/rpm packages installed above.
`
    : `
#
# Electron note: Electron *can* cross-build unsigned Windows NSIS/portable
# installers from macOS/Linux (Wine required), but CI builds are native and
# reproducible — and signing/notarization only works on the matching OS.
`;

  return header + '\n' + jobs + release + '\n' + trailer;
}

interface CiCommandOptions {
  output: string;
  release?: boolean;
  signing?: boolean;
  msi?: boolean;
  force?: boolean;
}

export function registerCi(program: Command): void {
  program
    .command('ci')
    .description(
      'Generate a GitHub Actions workflow that builds Windows, macOS and Linux artifacts',
    )
    .option('--output <path>', 'Workflow output path', '.github/workflows/build.yml')
    .option('--release', 'Add a job that publishes a GitHub Release on v* tags')
    .option('--signing', 'Wire code-signing secrets into the build (off by default)')
    .option('--msi', 'Also build an MSI on Windows (WiX required on the runner)')
    .option('--force', 'Overwrite an existing workflow file')
    .action(async (opts: CiCommandOptions) => {
      const { config, projectRoot } = await loadConfig(process.cwd());
      const outPath = path.resolve(projectRoot, opts.output);

      if (fs.existsSync(outPath) && !opts.force) {
        log.error(`Workflow already exists at ${opts.output}. Use --force to overwrite.`);
        process.exit(1);
      }

      const workflow = renderWorkflow({
        appName: config.appName,
        template: config.template,
        packageManager: config.packageManager,
        release: Boolean(opts.release),
        signing: Boolean(opts.signing),
        msi: Boolean(opts.msi),
      });

      fs.mkdirSync(path.dirname(outPath), { recursive: true });
      fs.writeFileSync(outPath, workflow, 'utf8');

      log.success(`Wrote ${opts.output}`);
      log.title('What happens next');
      log.dim('  1. Commit and push the workflow to GitHub.');
      log.dim('  2. Open the Actions tab — Windows, macOS and Linux jobs run in parallel.');
      log.dim('  3. Download installers from "Artifacts" on the run page.');
      if (opts.release) {
        log.dim('  4. Push a tag (git tag v0.1.0 && git push --tags) to publish a draft Release.');
      }
      if (opts.signing) {
        log.warn('Signing secrets must exist before the workflow runs:');
        log.dim('  WIN_CSC_LINK, WIN_CSC_KEY_PASSWORD (Windows Authenticode)');
        log.dim('  MAC_CSC_LINK, MAC_CSC_KEY_PASSWORD, APPLE_ID, APPLE_TEAM_ID,');
        log.dim('  APPLE_APP_SPECIFIC_PASSWORD (macOS), TAURI_SIGNING_PRIVATE_KEY (Tauri updater)');
      } else {
        log.warn('Signing is DISABLED in this workflow — builds are unsigned.');
        log.dim('  Re-run with --signing after adding certificates (see docs/signing.md).');
      }
      log.dim(
        '  Unsigned installers are not production-ready: SmartScreen/Gatekeeper will warn users.',
      );
    });
}
