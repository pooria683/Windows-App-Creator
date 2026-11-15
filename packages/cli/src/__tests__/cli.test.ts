/**
 * CLI integration tests — execute the built binary as a user would.
 * These require `npm run build` to have produced packages/cli/dist.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const run = promisify(execFile);
const here = path.dirname(fileURLToPath(import.meta.url));
const CLI = path.resolve(here, '../../dist/index.js');

interface Result {
  code: number;
  stdout: string;
  stderr: string;
}

async function cli(args: string[], cwd: string): Promise<Result> {
  try {
    const { stdout, stderr } = await run(process.execPath, [CLI, ...args], { cwd });
    return { code: 0, stdout, stderr };
  } catch (err) {
    const e = err as { code?: number; stdout?: string; stderr?: string };
    return { code: e.code ?? 1, stdout: e.stdout ?? '', stderr: e.stderr ?? '' };
  }
}

describe('CLI binary', () => {
  beforeAll(() => {
    if (!fs.existsSync(CLI)) {
      throw new Error(`Build the CLI first: missing ${CLI} (run \`npm run build\`)`);
    }
  });

  it('prints help listing every command', async () => {
    const { stdout } = await cli(['--help'], os.tmpdir());
    for (const cmd of ['create', 'dev', 'build', 'package', 'ci', 'doctor']) {
      expect(stdout).toContain(cmd);
    }
  });

  it('reports its version', async () => {
    const { stdout } = await cli(['--version'], os.tmpdir());
    expect(stdout.trim()).toMatch(/^\d+\.\d+\.\d+/);
  });

  it('scaffolds a project with flags and writes a valid config', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'winforge-it-'));
    const res = await cli(
      [
        'create',
        'cli-smoke',
        '--template',
        'electron',
        '--ui',
        'react',
        '--pm',
        'npm',
        '--app-name',
        'CLI Smoke',
        '--package-id',
        'com.example.smoke',
        '--app-version',
        '1.2.3',
        '--author',
        'Tester',
        '--description',
        'Smoke test app.',
        '--non-interactive',
        '--no-install',
      ],
      dir,
    );
    expect(res.code).toBe(0);
    expect(res.stdout).toContain('Scaffolded');

    const project = path.join(dir, 'cli-smoke');
    const cfg = JSON.parse(fs.readFileSync(path.join(project, 'winforge.config.json'), 'utf8'));
    expect(cfg).toMatchObject({
      name: 'cli-smoke',
      appName: 'CLI Smoke',
      packageId: 'com.example.smoke',
      version: '1.2.3',
      author: 'Tester',
      signing: { windows: { enabled: false } },
    });

    const pkg = JSON.parse(fs.readFileSync(path.join(project, 'package.json'), 'utf8'));
    expect(pkg.version).toBe('1.2.3');
    expect(pkg.build.appId).toBe('com.example.smoke');
    // Electron security defaults must be present in the generated main process.
    const main = fs.readFileSync(path.join(project, 'src/main/main.ts'), 'utf8');
    expect(main).toContain('contextIsolation: true');
    expect(main).toContain('nodeIntegration: false');
    expect(main).toContain('sandbox: true');

    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('rejects invalid input without writing files', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'winforge-it-'));
    const res = await cli(
      ['create', 'bad app!', '--non-interactive', '--no-install', '--package-id', 'nope'],
      dir,
    );
    expect(res.code).toBe(1);
    expect(res.stderr).toContain('Invalid project configuration');
    expect(fs.readdirSync(dir)).toHaveLength(0);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('refuses to scaffold into a non-empty directory without --force', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'winforge-it-'));
    fs.writeFileSync(path.join(dir, 'existing.txt'), 'keep me');
    const res = await cli(['create', '.', '--non-interactive', '--no-install'], dir);
    expect(res.code).toBe(1);
    expect(res.stderr).toContain('already exists');
    expect(res.stderr).toContain('--force');
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('generates a workflow that references all three runners', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'winforge-it-'));
    await cli(['create', 'ci-app', '--non-interactive', '--no-install'], dir);
    const project = path.join(dir, 'ci-app');

    const first = await cli(['ci'], project);
    expect(first.code).toBe(0);
    const wf = fs.readFileSync(path.join(project, '.github/workflows/build.yml'), 'utf8');
    for (const runner of ['windows-latest', 'macos-latest', 'ubuntu-latest']) {
      expect(wf).toContain(runner);
    }
    expect(wf).not.toContain('secrets.WIN_CSC_LINK'); // signing off by default

    // Idempotency guard: refuses to overwrite, works with --force.
    const second = await cli(['ci'], project);
    expect(second.code).toBe(1);
    const forced = await cli(['ci', '--release', '--force'], project);
    expect(forced.code).toBe(0);
    expect(fs.readFileSync(path.join(project, '.github/workflows/build.yml'), 'utf8')).toContain(
      'action-gh-release',
    );

    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('build --target windows on a Tauri project explains the CI requirement', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'winforge-it-'));
    await cli(
      ['create', 'tauri-app', '--template', 'tauri', '--non-interactive', '--no-install'],
      dir,
    );
    const res = await cli(['build', '--target', 'windows'], path.join(dir, 'tauri-app'));
    // On macOS/Linux this must not pretend to build; on Windows it would attempt it.
    if (process.platform !== 'win32') {
      expect(res.stdout).toMatch(/Cannot build "windows"|requires CI/);
      expect(res.stdout).toContain('winforge ci');
    }
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('rejects an invalid --target and an invalid --format', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'winforge-it-'));
    await cli(['create', 'fmt-app', '--non-interactive', '--no-install'], dir);
    const project = path.join(dir, 'fmt-app');

    const badTarget = await cli(['build', '--target', 'beos'], project);
    expect(badTarget.code).toBe(1);
    expect(badTarget.stderr).toContain('Invalid target');

    const badFormat = await cli(['package', '--format', 'snap'], project);
    expect(badFormat.code).toBe(1);
    expect(badFormat.stderr).toContain('Invalid format');

    fs.rmSync(dir, { recursive: true, force: true });
  });

  // `doctor` probes nine tools; on a cold Windows runner that used to take
  // longer than vitest's 5s default and fail the whole suite.
  it('doctor emits JSON describing host and capabilities', { timeout: 30_000 }, async () => {
    const { stdout } = await cli(['doctor', '--json'], os.tmpdir());
    const report = JSON.parse(stdout);
    expect(report.host.os).toMatch(/windows|macos|linux|unknown/);
    expect(Array.isArray(report.checks)).toBe(true);
    expect(report.capabilities).toHaveLength(3);
    expect(report.capabilities.map((c: { target: string }) => c.target).sort()).toEqual([
      'linux',
      'macos',
      'windows',
    ]);
  });
});
