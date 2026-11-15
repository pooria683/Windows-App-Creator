import { describe, it, expect } from 'vitest';
import { PM_COMMANDS, scriptCommandLine } from '../lib/runner.js';

describe('scriptCommandLine', () => {
  it('prints yarn scripts without "run"', () => {
    expect(scriptCommandLine('yarn', 'dev')).toBe('yarn dev');
  });

  it('prints npm/pnpm/bun scripts with "run"', () => {
    expect(scriptCommandLine('npm', 'build:windows')).toBe('npm run build:windows');
    expect(scriptCommandLine('pnpm', 'dev')).toBe('pnpm run dev');
    expect(scriptCommandLine('bun', 'test')).toBe('bun run test');
  });
});

describe('PM_COMMANDS', () => {
  it('maps every package manager to a runnable install/run pair', () => {
    for (const pm of ['npm', 'pnpm', 'yarn', 'bun'] as const) {
      expect(PM_COMMANDS[pm].install.length).toBeGreaterThan(0);
      expect(PM_COMMANDS[pm].run('dev').length).toBeGreaterThan(0);
    }
  });

  it('runs yarn scripts as `yarn <script>` (no "run")', () => {
    expect(PM_COMMANDS.yarn.run('dev')).toEqual(['dev']);
    expect(PM_COMMANDS.npm.run('dev')).toEqual(['run', 'dev']);
  });
});
