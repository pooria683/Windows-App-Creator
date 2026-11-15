/**
 * `winforge doctor`
 * Detects missing dependencies and prints clear installation instructions.
 */
import { Command } from 'commander';
import { log } from '../lib/logger.js';
import { detectHost, buildCapabilities, commandExists, getVersion } from '../lib/detect.js';
import { loadConfig } from '../lib/config.js';

interface CheckResult {
  name: string;
  ok: boolean;
  version: string | null;
  required: boolean;
  installHint: string;
}

async function check(
  cmd: string,
  name: string,
  required: boolean,
  installHint: string,
): Promise<CheckResult> {
  const ok = await commandExists(cmd);
  const version = ok ? await getVersion(cmd) : null;
  return { name, ok, version, required, installHint };
}

/** Install hints already start with an imperative verb; avoid "Install: Install:". */
function indentHint(hint: string): string {
  // Hints that already start with an action verb ("Install: …", "Ships with …")
  // are printed as-is; everything else gets an "Install:" prefix.
  return /^(install|ships|brew|sudo|curl|corepack|rustup|download)\b/i.test(hint)
    ? hint
    : `Install: ${hint}`;
}

export function registerDoctor(program: Command): void {
  program
    .command('doctor')
    .description('Detect missing dependencies and print installation instructions')
    .option('--json', 'Output machine-readable JSON')
    .action(async (opts: { json?: boolean }) => {
      const host = detectHost();

      // Try to load project config (optional — doctor works outside a project too).
      let template: 'electron' | 'tauri' | null = null;
      try {
        const { config } = await loadConfig(process.cwd());
        template = config.template;
      } catch {
        template = null;
      }

      const checks: CheckResult[] = [
        await check(
          'node',
          'Node.js (>=20)',
          true,
          'Install from https://nodejs.org (LTS) or via nvm: `nvm install 20`.',
        ),
        await check('npm', 'npm', true, 'Ships with Node.js. Reinstall Node.js if missing.'),
        await check('git', 'git', true, 'Install from https://git-scm.com/downloads.'),
        await check(
          'pnpm',
          'pnpm (optional)',
          false,
          'Install: `corepack enable && corepack prepare pnpm@latest --activate`.',
        ),
        await check(
          'yarn',
          'yarn (optional)',
          false,
          'Install: `corepack enable && corepack prepare yarn@stable --activate`.',
        ),
        await check(
          'bun',
          'bun (optional)',
          false,
          'Install: `curl -fsSL https://bun.sh/install | bash`.',
        ),
      ];

      if (template === 'tauri' || template === null) {
        checks.push(
          await check(
            'rustc',
            'Rust (rustc) — required for Tauri',
            template === 'tauri',
            'Install: https://rustup.rs — then `rustup default stable`.',
          ),
          await check(
            'cargo',
            'Cargo — required for Tauri',
            template === 'tauri',
            'Ships with rustup (https://rustup.rs).',
          ),
        );
      }
      if (template === 'electron' || template === null) {
        checks.push(
          await check(
            'wine',
            'Wine (optional, for Windows cross-build)',
            false,
            'macOS: `brew install --cask wine-stable`. Linux: `sudo apt install wine` (or your distro equivalent).',
          ),
        );
      }

      const caps = buildCapabilities(host, template ?? 'electron');

      if (opts.json) {
        console.log(JSON.stringify({ host, template, checks, capabilities: caps }, null, 2));
        return;
      }

      log.title('WinForge doctor');
      log.info(
        `Host OS: ${host.os}  Arch: ${host.arch}  Platform: ${host.platform}  CPUs: ${host.cpus}`,
      );
      if (template) log.info(`Project template: ${template}`);
      else log.dim('No WinForge project detected in this directory (checks are generic).');

      log.title('Dependencies');
      let missingRequired = 0;
      for (const c of checks) {
        if (c.ok) {
          log.success(`${c.name}${c.version ? ` — ${c.version}` : ''}`);
        } else if (c.required) {
          missingRequired++;
          log.error(`${c.name} — MISSING`);
          log.dim(`  ${indentHint(c.installHint)}`);
        } else {
          log.warn(`${c.name} — not found (optional)`);
          log.dim(`  ${indentHint(c.installHint)}`);
        }
      }

      log.title('Build capabilities on this machine');
      for (const cap of caps) {
        const mark = cap.canBuildLocally ? '✔' : '✖';
        log.info(`${mark} ${cap.target}: ${cap.method}`);
        log.dim(`   ${cap.notes}`);
      }

      log.title('Summary');
      if (missingRequired === 0) {
        log.success('All required dependencies found. You are ready to develop.');
      } else {
        log.error(
          `${missingRequired} required dependency(ies) missing. Install them using the hints above, then re-run \`winforge doctor\`.`,
        );
        process.exit(1);
      }
    });
}
