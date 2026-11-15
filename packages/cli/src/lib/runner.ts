/**
 * Process runner — spawns package-manager / builder commands.
 * All commands are idempotent where possible (install/build can be re-run).
 */
import { execa } from 'execa';
import type { PackageManager } from './validate.js';

export const PM_COMMANDS: Record<
  PackageManager,
  { install: string[]; run: (script: string) => string[]; exec: string }
> = {
  npm: { install: ['install'], run: (s) => ['run', s], exec: 'npx' },
  pnpm: { install: ['install'], run: (s) => ['run', s], exec: 'pnpm dlx' },
  yarn: { install: ['install'], run: (s) => [s], exec: 'yarn dlx' },
  bun: { install: ['install'], run: (s) => ['run', s], exec: 'bunx' },
};

/**
 * How to show a script invocation to the user, matching their package manager
 * (`yarn dev` vs `npm run dev`). Used in guidance messages, not for execution.
 */
export function scriptCommandLine(pm: PackageManager, script: string): string {
  return pm === 'yarn' ? `yarn ${script}` : `${pm} run ${script}`;
}

export interface RunOptions {
  cwd: string;
  env?: Record<string, string>;
}

export async function runPm(pm: PackageManager, args: string[], opts: RunOptions): Promise<void> {
  const { stdout, stderr } = await execa(pm, args, {
    cwd: opts.cwd,
    stdio: 'pipe',
    env: { ...process.env, ...opts.env },
  });
  if (stdout) process.stdout.write(stdout + '\n');
  if (stderr) process.stderr.write(stderr + '\n');
}

export async function runScript(
  pm: PackageManager,
  script: string,
  opts: RunOptions,
): Promise<void> {
  await runPm(pm, PM_COMMANDS[pm].run(script), opts);
}

export async function installDeps(pm: PackageManager, cwd: string): Promise<void> {
  await runPm(pm, PM_COMMANDS[pm].install, { cwd });
}
