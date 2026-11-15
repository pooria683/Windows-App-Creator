import { describe, it, expect } from 'vitest';
import { toProductName } from './helpers.js';

describe('template sanity', () => {
  it('product name helper works', () => {
    expect(toProductName('my-app')).toBe('MyApp');
  });
});
