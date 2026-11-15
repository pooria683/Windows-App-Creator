import { describe, it, expect } from 'vitest';
import {
  validateAppName,
  validatePackageId,
  validateVersion,
  validateAuthor,
  validateProjectConfig,
  toSlug,
  toProductName,
} from '../lib/validate.js';

describe('validateAppName', () => {
  it('accepts valid names', () => {
    expect(validateAppName('my-app')).toBe(true);
    expect(validateAppName('MyApp')).toBe(true);
    expect(validateAppName('app_1')).toBe(true);
  });
  it('rejects invalid names', () => {
    expect(validateAppName('')).not.toBe(true);
    expect(validateAppName('1app')).not.toBe(true);
    expect(validateAppName('my app')).not.toBe(true);
    expect(validateAppName('node_modules')).not.toBe(true);
  });
});

describe('validatePackageId', () => {
  it('accepts reverse-DNS', () => {
    expect(validatePackageId('com.example.myapp')).toBe(true);
    expect(validatePackageId('org.acme.desktop')).toBe(true);
  });
  it('rejects non-reverse-DNS', () => {
    expect(validatePackageId('myapp')).not.toBe(true);
    expect(validatePackageId('com..example')).not.toBe(true);
    expect(validatePackageId('')).not.toBe(true);
  });
});

describe('validateVersion', () => {
  it('accepts semver', () => {
    expect(validateVersion('1.0.0')).toBe(true);
    expect(validateVersion('0.1.0-beta.1')).toBe(true);
  });
  it('rejects non-semver', () => {
    expect(validateVersion('v1.0.0')).not.toBe(true);
    expect(validateVersion('1.0')).not.toBe(true);
    expect(validateVersion('latest')).not.toBe(true);
  });
});

describe('validateAuthor', () => {
  it('accepts normal authors', () => {
    expect(validateAuthor('Acme Inc.')).toBe(true);
  });
  it('rejects empty / dangerous input', () => {
    expect(validateAuthor('')).not.toBe(true);
    expect(validateAuthor('a; rm -rf /')).not.toBe(true);
  });
});

describe('validateProjectConfig', () => {
  it('returns no errors for a valid config', () => {
    expect(
      validateProjectConfig({
        name: 'my-app',
        packageId: 'com.example.myapp',
        version: '1.0.0',
        author: 'Acme',
        description: 'Test',
        template: 'electron',
        ui: 'react',
        packageManager: 'npm',
      }),
    ).toEqual([]);
  });
  it('collects multiple errors', () => {
    const errs = validateProjectConfig({ name: '1bad', version: 'nope', template: 'bad' as never });
    expect(errs.length).toBeGreaterThanOrEqual(3);
  });
});

describe('toSlug / toProductName', () => {
  it('slugifies display names', () => {
    expect(toSlug('My Cool App!')).toBe('my-cool-app');
  });
  it('builds PascalCase product names', () => {
    expect(toProductName('my-cool-app')).toBe('MyCoolApp');
  });
});
