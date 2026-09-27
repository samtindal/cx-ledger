import { describe, it, expect, vi, afterEach } from 'vitest';
import { ledgerReducer } from './store';
import { seedState } from '../data/seed';
import { applyChange } from './applyChange';

describe('ledgerReducer', () => {
  afterEach(() => vi.restoreAllMocks());

  it('returns the prior state when a change throws', () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const s = seedState();
    const dup = s.documents[0];
    let next: unknown;
    expect(() => { next = ledgerReducer(s, { type: 'change', change: { entity: 'document', op: 'create', value: dup } }); }).not.toThrow();
    expect(next).toBe(s);
    expect(err).toHaveBeenCalledTimes(1);
  });

  it('returns the prior state when a commit fn throws', () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const s = seedState();
    const fn = (st: typeof s) => applyChange(st, { entity: 'issue', op: 'update', key: 'CX-999', patch: { closed: null } }, { batchId: null });
    let next: unknown;
    expect(() => { next = ledgerReducer(s, { type: 'commit', fn }); }).not.toThrow();
    expect(next).toBe(s);
    expect(err).toHaveBeenCalledTimes(1);
  });

  it('still applies a valid change', () => {
    const s = seedState();
    const next = ledgerReducer(s, { type: 'change', change: { entity: 'issue', op: 'update', key: s.issues[0].id, patch: { desc: 'x' } } });
    expect(next.issues[0].desc).toBe('x');
  });
});
