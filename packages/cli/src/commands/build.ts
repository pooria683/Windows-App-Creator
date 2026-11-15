/**
 * `winforge build --target windows|macos|linux|all`
 * Builds the app for the requested target(s), with clear guidance on
 * which targets can be built locally vs. require GitHub Actions.
 */
import { Command } from 'commander';
import { log } from '../lib/logger.js';
import { loadConfig } from '../lib/config.js';
import { detectHost, buildCapabilities } from '../lib/detect.js';
import { runScript } from '../lib/runner.js';
import type { BuildTarget } from '../lib/validate.js';

const VALID_TARGETS: BuildTarget[] = ['windows', 'macos', 'linux', 'all'];

export function registerBuild(program: Command): void {
  program
    .command('build')
    .description('Build the app for a target platform')
    .requiredOption('--target <target>', 'Target: windows | macos | linux | all')
    .action(async (opts: { target: string }) => {
      const target = opts.target as BuildTarget;
      if (!VALID_TARGETS.includes(target)) {
        log.error(`Invalid target "${opts.target}". Use windows | macos | linux | all.`);
        process.exit(1);
      }

      const { config, projectRoot } = await loadConfig(process.cwd());
      const host = detectHost();
      const caps = buildCapabilities(host, config.template);

      log.title(`Building ${config.appName} for "${target}"`);
      log.info(`Host: ${host.os}/${host.arch}  Template: ${config.template}`);

      const targetsToBuild = target === 'all' ? (['windows', 'macos', 'linux'] as const) : [target];
      const blocked: string[] = [];

      for (const t of targetsToBuild) {
        const cap = caps.find((c) => c.target === t)!;
        if (!cap.canBuildLocally) {
          blocked.push(t);
          log.warn(`Cannot build "${t}" locally on ${host.os}: ${cap.notes}`);
          log.dim(`  → ${cap.method}`);
          continue;
        }
        log.info(`Building ${t} (${cap.method})…`);
        // Delegate to the project's own build script, which wraps
        // electron-builder / tauri build with the correct flags.
        const script = `build:${t}`;
        try {
          await runScript(config.packageManager, script, { cwd: projectRoot });
          log.success(`Built ${t}. Artifacts are in the project's release/ directory.`);
        } catch (err) {
          log.error(`Build for ${t} failed: ${(err as Error).message}`);
          log.dim(
            `  Tip: run \`${config.packageManager} run ${script}\` directly to see full output.`,
          );
          process.exit(1);
        }
      }

      if (blocked.length > 0) {
        log.title('Targets that require CI');
        log.dim(`  The following targets cannot be built on this machine: ${blocked.join(', ')}`);
        log.dim('  Generate a GitHub Actions workflow and push to GitHub:');
        log.dim('    winforge ci');
        log.dim('  The workflow builds Windows (.exe/.msi), macOS (.dmg) and Linux');
        log.dim('  (.AppImage/.deb/.rpm) on native runners and uploads all artifacts.');
      }

      // Nothing was produced: fail so scripts/CI notice, instead of a
      // misleading zero exit code after only printing guidance.
      if (blocked.length === targetsToBuild.length) {
        log.error(`No requested target could be built on this host (${blocked.join(', ')}).`);
        process.exit(1);
      }
    });
}
