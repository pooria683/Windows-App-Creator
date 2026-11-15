import { describe, it, expect } from 'vitest';
import { buildQuestions, answersToConfig, defaultPackageId } from '../lib/prompts.js';

interface QuestionShape {
  name: string;
  initial?: unknown;
  validate?: (v: string) => true | string;
}

function byName(name: string): QuestionShape {
  const q = buildQuestions().find((x) => x.name === name);
  if (!q) throw new Error(`missing prompt ${name}`);
  return q as QuestionShape;
}

describe('defaultPackageId', () => {
  it('derives a reverse-DNS id from the project slug', () => {
    expect(defaultPackageId('my-app')).toBe('com.example.myapp');
    expect(defaultPackageId('Acme_Cool_App')).toBe('com.example.acmecoolapp');
  });

  it('falls back when the name is empty', () => {
    expect(defaultPackageId('')).toBe('com.example.app');
    expect(defaultPackageId(undefined)).toBe('com.example.app');
  });
});

describe('buildQuestions', () => {
  it('asks for every required field', () => {
    const names = buildQuestions().map((q) => q.name);
    expect(names).toEqual([
      'name',
      'appName',
      'template',
      'ui',
      'packageManager',
      'packageId',
      'version',
      'author',
      'description',
    ]);
  });

  it('derives packageId from the answered project name (not the previous answer)', () => {
    const q = byName('packageId');
    const initial = q.initial as (prev: unknown, answers: Record<string, string>) => string;
    // Simulate prompts@2 calling with (prevAnswer, answersSoFar).
    expect(initial('bun', { name: 'cool-app' })).toBe('com.example.coolapp');
  });

  it('uses the answered project name as the display-name default', () => {
    const q = byName('appName');
    const initial = q.initial as (prev: unknown, answers: Record<string, string>) => string;
    expect(initial('my-app', { name: 'my-app' })).toBe('my-app');
  });

  it('rejects invalid input through the prompt validators', () => {
    expect(byName('name').validate?.('1 bad')).not.toBe(true);
    expect(byName('name').validate?.('good-app')).toBe(true);
    expect(byName('packageId').validate?.('not-reverse-dns')).not.toBe(true);
    expect(byName('version').validate?.('v1.0.0')).not.toBe(true);
    expect(byName('version').validate?.('1.0.0')).toBe(true);
    expect(byName('author').validate?.('a; rm -rf /')).not.toBe(true);
    expect(byName('author').validate?.('Acme Inc.')).toBe(true);
  });
});

describe('answersToConfig', () => {
  it('applies fallbacks for missing answers', () => {
    const cfg = answersToConfig({ name: 'demo' });
    expect(cfg.name).toBe('demo');
    expect(cfg.appName).toBe('demo');
    expect(cfg.packageId).toBe(defaultPackageId('demo'));
    expect(cfg.version).toBe('0.1.0');
    expect(cfg.template).toBe('electron');
    expect(cfg.ui).toBe('react');
    expect(cfg.packageManager).toBe('npm');
  });

  it('keeps explicit answers', () => {
    const cfg = answersToConfig({
      name: 'demo',
      appName: 'Demo App',
      packageId: 'io.example.demo',
      version: '2.1.0',
      author: 'Example Ltd',
      description: 'Demo.',
      template: 'tauri',
      ui: 'svelte',
      packageManager: 'bun',
    });
    expect(cfg).toMatchObject({
      appName: 'Demo App',
      packageId: 'io.example.demo',
      version: '2.1.0',
      template: 'tauri',
      ui: 'svelte',
      packageManager: 'bun',
    });
  });
});
