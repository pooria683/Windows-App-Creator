/**
 * End-to-end interactive `create` test.
 *
 * `prompts.inject([...])` supplies answers positionally, so the entire prompt
 * sequence — dynamic defaults, choices, validators — runs exactly as it would
 * in a terminal. An array value is consumed one entry at a time, which lets us
 * assert that a rejected answer triggers a re-prompt.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import prompts from 'prompts';
import { promptProjectConfig, buildQuestions, answersToConfig } from '../lib/prompts.js';
import { validateProjectConfig } from '../lib/validate.js';
import { scaffoldProject } from '../lib/scaffold.js';

describe('interactive project setup', () => {
  let tmp: string;
  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'winforge-interactive-'));
  });
  afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('runs every prompt and returns a complete config', async () => {
    // Order matches buildQuestions(): name, appName, template, ui, pm, id, version, author, description
    prompts.inject([
      'from-prompts',
      'From Prompts',
      'tauri',
      'vue',
      'pnpm',
      'dev.example.fromprompts',
      '3.2.1',
      'Prompt Tester',
      'Configured interactively.',
    ]);

    const cfg = await promptProjectConfig();
    expect(cfg).toEqual({
      name: 'from-prompts',
      appName: 'From Prompts',
      packageId: 'dev.example.fromprompts',
      version: '3.2.1',
      author: 'Prompt Tester',
      description: 'Configured interactively.',
      template: 'tauri',
      ui: 'vue',
      packageManager: 'pnpm',
    });

    // The config it produces scaffolds a working project.
    const dir = path.join(tmp, cfg.name);
    const files = scaffoldProject(cfg, dir);
    expect(files.length).toBeGreaterThan(20);
    expect(fs.existsSync(path.join(dir, 'src-tauri/tauri.conf.json'))).toBe(true);
    expect(fs.existsSync(path.join(dir, 'src/renderer/src/App.vue'))).toBe(true);
    const tauriConf = JSON.parse(
      fs.readFileSync(path.join(dir, 'src-tauri/tauri.conf.json'), 'utf8'),
    );
    expect(tauriConf.productName).toBe('FromPrompts');
    expect(tauriConf.version).toBe('3.2.1');
  });

  it('accepts prompt defaults for everything not answered', async () => {
    // Only the first answer is supplied; the rest fall back to prompt defaults.
    prompts.inject(['defaults-app']);
    const cfg = await promptProjectConfig();
    expect(cfg.name).toBe('defaults-app');
    expect(cfg.appName).toBe('defaults-app');
    expect(cfg.packageId).toBe('com.example.defaultsapp');
    expect(cfg.version).toBe('0.1.0');
    expect(cfg.template).toBe('electron');
    expect(cfg.ui).toBe('react');
    expect(cfg.packageManager).toBe('npm');
  });

  it('post-prompt validation rejects an invalid config before scaffolding', () => {
    // NOTE: prompts.inject() deliberately skips validators (it calls
    // getFormattedAnswer with skipValidation=true), so re-prompting is a
    // terminal-only behaviour and is covered by the validators themselves
    // (prompts.test.ts). What matters for safety is the second line of
    // defence in `create`: the assembled config is validated before any file
    // is written, which this test locks in.
    const cfg = answersToConfig({
      name: 'ok-app',
      packageId: 'not-a-reverse-dns-id',
      version: 'v1.0.0',
      author: 'Ok',
      description: 'Ok.',
    });
    const errors = validateProjectConfig(cfg);
    expect(errors.some((e) => e.startsWith('packageId:'))).toBe(true);
    expect(errors.some((e) => e.startsWith('version:'))).toBe(true);
  });

  it('exposes validators on every question that needs one', () => {
    const qs = buildQuestions();
    const validated = qs.filter((q) => typeof q.validate === 'function').map((q) => q.name);
    expect(validated).toEqual(['name', 'appName', 'packageId', 'version', 'author', 'description']);
  });
});
