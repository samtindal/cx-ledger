import { describe, it, expect } from 'vitest';
import { applyChange } from './applyChange';
import { seedState } from '../data/seed';

const NOW = new Date(2026, 8, 26, 12);
const AT = '2026-09-26T16:00:00.000Z';

describe('applyChange', () => {
  it('writes one record per changed field on update', () => {
    const s0 = seedState(NOW);
    const s1 = applyChange(s0, { entity: 'equipment', op: 'update', key: 'AHU-1', patch: { serial: 'X', location: 'Mech 101' } }, { batchId: null, at: AT });
    expect(s1.equipment.find((e) => e.tag === 'AHU-1')!.serial).toBe('X');
    expect(s1.changes).toEqual([
      { id: 'CR-00001', batchId: null, entity: 'equipment', key: 'AHU-1', op: 'update', field: 'serial', before: 'K22H4410', after: 'X', at: AT, actor: 'Demo user' },
    ]);
    expect(s0.equipment.find((e) => e.tag === 'AHU-1')!.serial).toBe('K22H4410'); // no mutation
  });
  it('returns the same state when nothing changes', () => {
    const s0 = seedState(NOW);
    expect(applyChange(s0, { entity: 'equipment', op: 'update', key: 'AHU-1', patch: { serial: 'K22H4410' } }, { batchId: null })).toBe(s0);
  });
  it('creates and deletes with whole-entity before/after', () => {
    const s0 = seedState(NOW);
    const issue = { id: 'CX-017', tag: 'AHU-1', desc: 'x', severity: 'Minor' as const, trade: 'TAB' as const, opened: '2026-09-26', closed: null };
    const s1 = applyChange(s0, { entity: 'issue', op: 'create', value: issue }, { batchId: 'IMP-0001', at: AT });
    expect(s1.issues).toHaveLength(17);
    expect(s1.changes[0]).toMatchObject({ entity: 'issue', key: 'CX-017', op: 'create', after: issue, batchId: 'IMP-0001' });
    const s2 = applyChange(s1, { entity: 'issue', op: 'delete', key: 'CX-017' }, { batchId: null, at: AT });
    expect(s2.issues).toHaveLength(16);
    expect(s2.changes[1]).toMatchObject({ id: 'CR-00002', op: 'delete', before: issue });
  });
  it('records array fields (pfc) with before/after arrays', () => {
    const s0 = seedState(NOW);
    const before = s0.equipment.find((e) => e.tag === 'EF-1')!.pfc;
    const after = before.map(() => true);
    const s1 = applyChange(s0, { entity: 'equipment', op: 'update', key: 'EF-1', patch: { pfc: after } }, { batchId: null, at: AT });
    expect(s1.changes[0]).toMatchObject({ field: 'pfc', before, after });
  });
  it('rejects duplicate creates, missing keys, and key changes', () => {
    const s0 = seedState(NOW);
    const ahu1 = s0.equipment[0];
    expect(() => applyChange(s0, { entity: 'equipment', op: 'create', value: ahu1 }, { batchId: null })).toThrow(/already exists/);
    expect(() => applyChange(s0, { entity: 'equipment', op: 'update', key: 'NOPE-1', patch: { desc: 'x' } }, { batchId: null })).toThrow(/not found/);
    expect(() => applyChange(s0, { entity: 'equipment', op: 'update', key: 'AHU-1', patch: { tag: 'AHU-9' } }, { batchId: null })).toThrow(/key/);
  });
});
