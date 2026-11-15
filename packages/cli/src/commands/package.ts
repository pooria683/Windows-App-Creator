/**
 * `winforge package --format exe|msi|dmg|appimage|deb|rpm`
 * Packages a built app into a distributable installer/package.
 */
import { Command } from 'commander';
import { log } from '../lib/logger.js';
import { loadConfig } from '../lib/config.js';
import { detectHost, buildCapabilities } from '../lib/detect.js';
import { runScript, scriptCommandLine } from '../lib/runner.js';
import type { PackageFormat } from '../lib/validate.js';

const VALID_FORMATS: PackageFormat[] = ['exe', 'msi', 'dmg', 'appimage', 'deb', 'rpm'];

const FORMAT_TO_TARGET: Record<PackageFormat, 'windows' | 'macos' | 'linux'> = {
  exe: 'windows',
  msi: 'windows',
  dmg: 'macos',
  appimage: 'linux',
  deb: 'linux',
  rpm: 'linux',
};

export function registerPackage(program: Command): void {
  program
    .command('package')
    .description('Package the app into an installer / package format')
    .requiredOption('--format <format>', 'Format: exe | msi | dmg | appimage | deb | rpm')
    .action(async (opts: { format: string }) => {
      const format = opts.format as PackageFormat;
      if (!VALID_FORMATS.includes(format)) {
        log.error(`Invalid format "${opts.format}". Use ${VALID_FORMATS.join(' | ')}.`);
        process.exit(1);
      }

      const { config, projectRoot } = await loadConfig(process.cwd());
      const host = detectHost();
      const target = FORMAT_TO_TARGET[format];
      const cap = buildCapabilities(host, config.template).find((c) => c.target === target)!;

      log.title(`Packaging ${config.appName} as .${format} (${target})`);

      if (!cap.canBuildLocally) {
        log.warn(`Format ".${format}" cannot be produced locally on ${host.os}.`);
        log.dim(`  Reason: ${cap.notes}`);
        log.dim('  Run `winforge ci` to generate a GitHub Actions workflow that');
        log.dim('  builds this format on a native runner, then download the artifact.');
        process.exit(1);
      }

      const script = `package:${format}`;
      log.info(`Running ${scriptCommandLine(config.packageManager, script)}…`);
      try {
        await runScript(config.packageManager, script, { cwd: projectRoot });
        log.success(`Packaged .${format}. See release/ for the installer.`);
        if (config.signing?.windows?.enabled === false && target === 'windows') {
          log.warn('Note: this installer is UNSIGNED. Windows SmartScreen will warn users.');
          log.dim('  See docs/signing.md to configure Authenticode signing (disabled by default).');
        }
      } catch (err) {
        log.error(`Packaging failed: ${(err as Error).message}`);
        process.exit(1);
      }
    });
}
