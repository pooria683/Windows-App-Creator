import { describe, it, expect } from 'vitest';
import {
  buildCreateCommand,
  quote,
  validatePackageId,
  validateProjectName,
} from '../lib/command.js';

describe('buildCreateCommand', () => {
  it('assembles a create command with all flags', () => {
    const cmd = buildCreateCommand({
      projectName: 'my-app',
      template: 'tauri',
      ui: 'react',
      pm: 'pnpm',
      packageId: 'com.example.myapp',
    });
    expect(cmd).toBe(
      'winforge create my-app --template tauri --ui react --pm pnpm --package-id com.example.myapp',
    );
  });

  it('quotes unsafe values instead of injecting them', () => {
    expect(quote('my app')).toBe("'my app'");
    expect(quote("it's")).toBe("'it'\\''s'");
  });
});

describe('validation', () => {
  it('accepts valid names and ids', () => {
    expect(validateProjectName('my-app')).toBeNull();
    expect(validatePackageId('com.example.myapp')).toBeNull();
  });
  it('rejects invalid values', () => {
    expect(validateProjectName('1bad')).not.toBeNull();
    expect(validatePackageId('myapp')).not.toBeNull();
  });
});
