// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { loadState, saveState, STORAGE_KEY } from './persist';
import { seedState } from '../data/seed';

const NOW = new Date(2026, 8, 26, 12);

describe('persistence', () => {
  beforeEach(() => localStorage.clear());
  it('round-trips state', () => {
    const s = seedState(NOW);
    s.equipment[0] = { ...s.equipment[0], serial: 'CHANGED' };
    saveState(s);
    expect(loadState(NOW)).toEqual(s);
  });
  it('falls back to seed when nothing is saved', () => {
    expect(loadState(NOW)).toEqual(seedState(NOW));
  });
  it.each([
    ['bad JSON', '{not json'],
    ['wrong version', JSON.stringify({ version: 99 })],
    ['missing arrays', JSON.stringify({ version: 1, equipment: [] })],
    ['null', 'null'],
  ])('falls back to seed on %s (Review Focus #5)', (_, raw) => {
    localStorage.setItem(STORAGE_KEY, raw);
    expect(loadState(NOW)).toEqual(seedState(NOW));
  });
});
