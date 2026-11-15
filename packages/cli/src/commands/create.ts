/**
 * `winforge create <project-name>`
 * Scaffolds a new Electron or Tauri project from a template.
 *
 * The positional argument may also be a path (`winforge create apps/my-app`);
 * the app/package name is derived from the final path segment.
 */
import fs from 'node:fs';
import path from 'node:path';
import { Command } from 'commander';
import { log } from '../lib/logger.js';
import { validateProjectConfig, toSlug, type ProjectConfig } from '../lib/validate.js';
import { scaffoldProject } from '../lib/scaffold.js';
import { promptProjectConfig } from '../lib/prompts.js';
import { installDeps } from '../lib/runner.js';

interface CreateOptions {
  template?: string;
  ui?: string;
  pm?: string;
  packageManager?: string;
  appName?: string;
  packageId?: string;
  description?: string;
  author?: string;
  appVersion?: string;
  nonInteractive?: boolean;
  force?: boolean;
  install?: boolean;
  templatesRoot?: string;
}

export function registerCreate(program: Command): void {
  program
    .command('create <project-name>')
    .description('Create a new project from a template (Electron or Tauri)')
    .option('--template <kind>', 'Template: electron | tauri')
    .option('--ui <framework>', 'UI framework: react | vue | svelte | vanilla')
    .option('--pm <manager>', 'Package manager: npm | pnpm | yarn | bun')
    .option('--app-name <name>', 'App display name (defaults to project name)')
    .option('--package-id <id>', 'Reverse-DNS package identifier, e.g. com.example.myapp')
    .option('--description <text>', 'App description')
    .option('--author <name>', 'Author / publisher')
    .option('--app-version <semver>', 'Initial app version (default 0.1.0)')
    .option('--non-interactive', 'Skip prompts (use flags/defaults)')
    .option('--force', 'Allow scaffolding into a non-empty directory')
    .option('--no-install', 'Skip dependency installation')
    .option('--templates-root <path>', 'Path to templates root (advanced)')
    .action(async (projectArg: string, opts: CreateOptions) => {
      const pm = (opts.pm ?? opts.packageManager ?? 'npm') as ProjectConfig['packageManager'];
      // The positional argument may be a path; the name comes from its basename.
      const destDir = path.resolve(process.cwd(), projectArg);
      const derivedName = toSlug(path.basename(destDir)) || 'winforge-app';
      let cfg: ProjectConfig;

      if (opts.nonInteractive) {
        cfg = {
          name: derivedName,
          appName: opts.appName ?? derivedName,
          packageId:
            opts.packageId ??
            `com.example.${derivedName.replace(/[^a-z0-9]/gi, '').toLowerCase() || 'app'}`,
          version: opts.appVersion ?? '0.1.0',
          author: opts.author ?? 'Your Name',
          description: opts.description ?? 'A desktop app built with WinForge.',
          template: (opts.template as ProjectConfig['template']) ?? 'electron',
          ui: (opts.ui as ProjectConfig['ui']) ?? 'react',
          packageManager: pm,
        };
      } else {
        cfg = await promptProjectConfig({
          name: derivedName,
          appName: opts.appName,
          template: opts.template as ProjectConfig['template'],
          ui: opts.ui as ProjectConfig['ui'],
          packageManager: pm,
          packageId: opts.packageId,
          version: opts.appVersion,
          author: opts.author,
          description: opts.description,
        });
      }

      const errors = validateProjectConfig(cfg);
      if (errors.length > 0) {
        log.error('Invalid project configuration:');
        for (const e of errors) log.error(`  - ${e}`);
        process.exit(1);
      }

      if (fs.existsSync(destDir) && fs.readdirSync(destDir).length > 0 && !opts.force) {
        log.error(
          `Directory "${path.relative(process.cwd(), destDir) || '.'}" already exists and is not empty.`,
        );
        log.hint('  Use --force to scaffold into it anyway (existing files are overwritten).');
        process.exit(1);
      }

      log.title(`Creating ${cfg.appName} (${cfg.template} + ${cfg.ui})`);
      log.info(`Package ID: ${cfg.packageId}  Version: ${cfg.version}  PM: ${cfg.packageManager}`);
      log.info(`Destination: ${destDir}`);

      const files = scaffoldProject(cfg, destDir, { templatesRoot: opts.templatesRoot });
      log.success(`Scaffolded ${files.length} files.`);

      if (opts.install !== false) {
        log.info(`Installing dependencies with ${cfg.packageManager}…`);
        try {
          await installDeps(cfg.packageManager, destDir);
          log.success('Dependencies installed.');
        } catch (err) {
          log.warn(
            `Dependency install failed (you can run it manually): ${(err as Error).message}`,
          );
          log.dim(
            `  cd ${path.relative(process.cwd(), destDir) || '.'} && ${cfg.packageManager} install`,
          );
        }
      }

      const rel = path.relative(process.cwd(), destDir) || '.';
      log.title('Next steps');
      log.dim(`  cd ${rel}`);
      log.dim(`  ${cfg.packageManager} run dev                # development with hot reload`);
      log.dim(`  winforge build --target windows          # Windows .exe / installer`);
      log.dim(`  winforge ci                              # GitHub Actions workflow`);
      log.dim(`  winforge doctor                          # check your environment`);
      if (cfg.template === 'tauri') {
        log.warn('Tauri Windows builds require a Windows runner (use `winforge ci`).');
      } else {
        log.warn('Windows builds work locally via electron-builder (Wine recommended).');
      }
      log.dim('  Signing is disabled by default — see docs/signing.md before distributing.');
    });
}
