/**
 * WinForge CLI — program setup.
 */
import { Command } from 'commander';
import { registerCreate } from './commands/create.js';
import { registerDev } from './commands/dev.js';
import { registerBuild } from './commands/build.js';
import { registerPackage } from './commands/package.js';
import { registerCi } from './commands/ci.js';
import { registerDoctor } from './commands/doctor.js';

export function createProgram(): Command {
  const program = new Command();

  program
    .name('winforge')
    .description(
      'WinForge — scaffold, develop, build and package Windows desktop apps (Electron & Tauri) from macOS and Linux',
    )
    .version('0.1.0');

  registerCreate(program);
  registerDev(program);
  registerBuild(program);
  registerPackage(program);
  registerCi(program);
  registerDoctor(program);

  return program;
}
