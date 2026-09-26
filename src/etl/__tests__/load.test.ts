import { describe, it, expect } from 'vitest';
import type { AppState } from '../../types';
import { seedState } from '../../data/seed';
import { parseCsv } from '../parseCsv';
import { runPipeline, buildBatch } from '../stage';
import { stageBatch, nextBatchId, loadBatch, approveAll, setApproval } from '../load';
import { rollbackBatch, findRollbackConflicts } from '../rollback';
import { applyChange } from '../../state/applyChange';
import { loadFixtureText } from './fixtures';

const NOW = new Date(2026, 8, 26, 12);
const CSV = loadFixtureText('contractor-export.csv');

function stage(s: AppState, text: string, source = 'contractor-export.csv'): [AppState, string] {
  const r = runPipeline({ grid: parseCsv(text), register: s.equipment, profiles: s.profiles });
  const id = nextBatchId(s.batches);
  return [stageBatch(s, buildBatch(r, { id, source, origin: 'csv', createdAt: '2026-09-26T12:00:00Z' })), id];
}
const eq = (s: AppState, tag: string) => s.equipment.find((e) => e.tag === tag);

describe('load', () => {
  it('loads the golden file: 7 created, 2 updated', () => {
    const [s1, id] = stage(seedState(NOW), CSV);
    expect(id).toBe('IMP-0001');
    const { state, report } = loadBatch(s1, id);
    expect(report.created.sort()).toEqual(['AHU-3', 'CH-2', 'EF-4', 'P-5', 'VAV-2-15', 'XFMR-T1', 'ZZ-9']);
    expect(report.updated.sort()).toEqual(['AHU-1', 'GEN-1']);
    expect(report.skipped).toBe(2); // duplicate + error
    expect(state.batches[0]).toMatchObject({ status: 'loaded' });
    expect(state.batches[0].input).toBeUndefined();
    expect(eq(state, 'VAV-2-15')).toMatchObject({ pfc: [false, false, false, false, false], fpt: 'Not started', system: 'Air side' });
    expect(eq(state, 'XFMR-T1')!.pfc).toHaveLength(6);
    expect(eq(state, 'ZZ-9')).toMatchObject({ system: 'Unassigned', type: 'ZZ' });
    expect(eq(state, 'GEN-1')).toMatchObject({ desc: 'Diesel generator, 250 kW', serial: 'CAT00C9XK' });
    expect(state.changes.every((c) => c.batchId === 'IMP-0001')).toBe(true);
  });
  it('is idempotent: second load of the same file is all no-change', () => {
    const [s1, id] = stage(seedState(NOW), CSV);
    const { state } = loadBatch(s1, id);
    const [s2, id2] = stage(state, CSV);
    expect(s2.batches.find((b) => b.id === id2)!.counts).toEqual({ new: 0, update: 0, noChange: 9, duplicate: 1, error: 1, blank: 1 });
  });
  it('re-diffs a stale staged batch against the current register (Review Focus #3)', () => {
    let [s, id] = stage(seedState(NOW), CSV);
    s = applyChange(s, { entity: 'equipment', op: 'update', key: 'AHU-1', patch: { location: 'Mech Rm 999', serial: 'K22H4410-R' } }, { batchId: null });
    const { state, report } = loadBatch(s, id);
    const recs = state.changes.filter((c) => c.batchId === id && c.key === 'AHU-1');
    expect(recs.map((c) => [c.field, c.before, c.after])).toEqual([
      ['desc', 'Air handling unit, admin wing', 'Air handling unit - admin wing'],
      ['location', 'Mech Rm 999', 'Mech Rm 101'],
    ]);
    expect(report.updated).toContain('AHU-1');
  });
  it('respects approvals', () => {
    let [s, id] = stage(seedState(NOW), CSV);
    s = setApproval(s, id, 11, false); // CH-2
    s = setApproval(s, id, 12, true);  // error row: no-op
    const { state, report } = loadBatch(s, id);
    expect(eq(state, 'CH-2')).toBeUndefined();
    expect(report.created).not.toContain('CH-2');
    expect(state.batches[0].rows.find((r) => r.rowNum === 12)!.approved).toBe(false);
  });
});

describe('rollback', () => {
  it('restores the seed register exactly', () => {
    const seed = seedState(NOW);
    const [s1, id] = stage(seed, CSV);
    const { state } = loadBatch(approveAll(s1, id), id);
    const r = rollbackBatch(state, id);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.state.equipment).toEqual(seed.equipment);
    expect(r.state.batches[0].status).toBe('rolled back');
    expect(r.state.changes.length).toBeGreaterThan(state.changes.length);
  });
  it('blocks when a unit was edited after the import, naming it', () => {
    const [s1, id] = stage(seedState(NOW), CSV);
    let { state } = loadBatch(s1, id);
    const pfc = eq(state, 'AHU-3')!.pfc;
    state = applyChange(state, { entity: 'equipment', op: 'update', key: 'AHU-3', patch: { pfc: [true, ...pfc.slice(1)] } }, { batchId: null });
    state = applyChange(state, { entity: 'equipment', op: 'update', key: 'AHU-3', patch: { pfc: [true, true, ...pfc.slice(2)] } }, { batchId: null });
    const r = rollbackBatch(state, id);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.conflicts).toEqual([{ key: 'AHU-3', fields: ['checklist'], count: 2,
      message: 'AHU-3 was edited after this import (checklist, 2 changes). Roll back those first or keep the batch.' }]);
  });
  it('is LIFO across imports (Review Focus #4)', () => {
    const seed = seedState(NOW);
    let [s, a] = stage(seed, CSV);
    s = loadBatch(s, a).state;
    let b: string;
    [s, b] = stage(s, 'Tag,Serial\nAHU-1,X-1\n', 'fix.csv');
    s = loadBatch(s, b).state;
    expect(findRollbackConflicts(s, a).map((c) => c.message)).toEqual([
      'AHU-1 was edited after this import (serial, 1 change). Roll back those first or keep the batch.',
    ]);
    const rb = rollbackBatch(s, b);
    expect(rb.ok).toBe(true);
    if (!rb.ok) return;
    const ra = rollbackBatch(rb.state, a);
    expect(ra.ok).toBe(true);
    if (!ra.ok) return;
    expect(ra.state.equipment).toEqual(seed.equipment);
  });
});
