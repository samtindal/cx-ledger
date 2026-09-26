import { describe, it, expect } from 'vitest';
import { applyChange } from '../state/applyChange';
import { seedState } from '../data/seed';
import { historyFor, describeChange } from './history';
import { nextIssueId } from './issues';

describe('history', () => {
  it('lists newest first and describes changes', () => {
    let s = seedState(new Date(2026, 8, 26, 12));
    const pfc = s.equipment.find((e) => e.tag === 'EF-1')!.pfc;
    s = applyChange(s, { entity: 'equipment', op: 'update', key: 'EF-1', patch: { pfc: pfc.map(() => true) } }, { batchId: null, at: '2026-09-26T10:00:00Z' });
    s = applyChange(s, { entity: 'equipment', op: 'update', key: 'EF-1', patch: { fpt: 'Scheduled' } }, { batchId: null, at: '2026-09-26T11:00:00Z' });
    const h = historyFor(s, 'equipment', 'EF-1');
    expect(h.map((r) => r.field)).toEqual(['fpt', 'pfc']);
    expect(describeChange(h[1])).toBe('checklist: 5/6 → 6/6');
    expect(describeChange(h[0])).toBe('FPT: "Not started" → "Scheduled"');
  });
  it('nextIssueId increments the max', () => {
    expect(nextIssueId(seedState().issues)).toBe('CX-017');
    expect(nextIssueId([])).toBe('CX-001');
  });
});
