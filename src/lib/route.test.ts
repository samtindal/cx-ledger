import { describe, it, expect } from 'vitest';
import { parseHash, TABS } from './route';

describe('parseHash', () => {
  it('maps known hashes to tabs', () => {
    expect(parseHash('#import')).toBe('import');
    expect(parseHash('#Equipment')).toBe('equipment');
    expect(parseHash('#equipment/AHU-1')).toBe('equipment');
  });
  it('falls back to overview', () => {
    expect(parseHash('')).toBe('overview');
    expect(parseHash('#')).toBe('overview');
    expect(parseHash('#bogus')).toBe('overview');
  });
  it('lists tabs in display order', () => {
    expect(TABS).toEqual(['overview', 'equipment', 'issues', 'documents', 'import']);
  });
});
