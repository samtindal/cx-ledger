import { describe, it, expect } from 'vitest';
import { startSession, restage, stepSummary, mappingDetails, applySuggestedProfile, loadSession, rollbackSession } from './session';
import { seedState } from '../../data/seed';
import { parseCsv } from '../../etl/parseCsv';
import { readWorkbook } from '../../etl/readWorkbook';
import { loadBatch, updateStaged } from '../../etl/load';
import { addProfile, createProfile } from '../../etl/profiles';
import { applyChange } from '../../state/applyChange';
import { loadFixtureBytes, loadFixtureText } from '../../etl/__tests__/fixtures';

const NOW = new Date(2026, 8, 26, 12);

describe('import session', () => {
  it('stages a CSV and summarizes steps', () => {
    const s = startSession(seedState(NOW), { source: 'contractor-export.csv', origin: 'csv', sheets: [{ sheetName: 'CSV', rows: parseCsv(loadFixtureText('contractor-export.csv')) }] });
    const b = s.batches[0];
    expect(b).toMatchObject({ id: 'IMP-0001', status: 'staged' });
    expect(stepSummary(b).map((x) => x.value)).toEqual(['12 rows', '6/6 columns', '5 tags normalized', '1 error, 2 warnings', '9 approved', '—']);
    const { state, report } = loadBatch(s, 'IMP-0001');
    expect(stepSummary(state.batches[0], report)[5].value).toBe('7 new, 2 updated');
  });
  it('preselects the schedule sheet and reports title rows', () => {
    const s = startSession(seedState(NOW), { source: 'contractor-schedule.xlsx', origin: 'xlsx', sheets: readWorkbook(loadFixtureBytes('contractor-schedule.xlsx')) });
    expect(s.batches[0]).toMatchObject({ sheetName: 'Equipment Schedule', skippedTitleRows: 3 });
    expect(stepSummary(s.batches[0])[0].value).toBe('12 rows · 3 title rows skipped');
  });
  it('restages live on mapping change and keeps approvals', () => {
    let s = startSession(seedState(NOW), { source: 'x.csv', origin: 'csv', sheets: [{ sheetName: 'CSV', rows: parseCsv(loadFixtureText('contractor-export.csv')) }] });
    const b = s.batches[0];
    s = { ...s, batches: [{ ...b, rows: b.rows.map((r) => (r.tag === 'CH-2' ? { ...r, approved: false } : r)) }] };
    s = restage(s, b.id, { mapping: { ...b.mapping, serial: null } });
    const nb = s.batches[0];
    expect(nb.mapping.serial).toBeNull();
    expect(nb.rows.find((r) => r.tag === 'CH-2')!.approved).toBe(false);
    expect(nb.counts.update).toBe(1); // GEN-1's only change was the serial
  });
});

describe('import session helpers', () => {
  const csv = () => ({ source: 'x.csv', origin: 'csv' as const, sheets: [{ sheetName: 'CSV', rows: parseCsv(loadFixtureText('contractor-export.csv')) }] });

  it('reports mapping confidence and header confidence', () => {
    const s = startSession(seedState(NOW), csv());
    const d = mappingDetails(s, s.batches[0]);
    expect(d.headerConfident).toBe(true);
    expect(d.confidence.tag).toBeGreaterThan(0);
    expect(d.confidence.system).toBeNull();
    expect(d.profile).toBeNull();
  });
  it('suggests a near-match profile and applies it', () => {
    let s = startSession(seedState(NOW), csv());
    const b = s.batches[0];
    const p = createProfile({ name: 'Contractor', headers: [...b.headers, 'Extra A'], mapping: b.mapping, headerRow: 0, existing: [], now: '2026-01-01T00:00:00.000Z' });
    s = addProfile(s, p);
    expect(mappingDetails(s, s.batches[0]).profile).toMatchObject({ mode: 'suggested', profile: { id: p.id } });
    s = applySuggestedProfile(s, b.id, p.id);
    expect(s.batches[0].profileId).toBe(p.id);
    expect(mappingDetails(s, s.batches[0])).toMatchObject({ profile: { mode: 'applied' }, confidence: { tag: 1 } });
  });
  it('loads a staged batch, touches its profile, and is a no-op once loaded', () => {
    let s = startSession(seedState(NOW), csv());
    const b = s.batches[0];
    const p = createProfile({ name: 'Contractor', headers: b.headers, mapping: b.mapping, headerRow: 0, existing: [], now: '2026-01-01T00:00:00.000Z' });
    s = updateStaged(addProfile(s, p), b.id, (x) => ({ ...x, profileId: p.id }));
    const loaded = loadSession(s, b.id, '2026-09-26T12:00:00.000Z');
    expect(loaded.batches[0].status).toBe('loaded');
    expect(loaded.profiles[0].lastUsed).toBe('2026-09-26T12:00:00.000Z');
    expect(loadSession(loaded, b.id)).toBe(loaded);
  });
  it('rolls back a loaded batch and is a no-op when blocked or not loaded', () => {
    const staged = startSession(seedState(NOW), csv());
    expect(rollbackSession(staged, 'IMP-0001')).toBe(staged);
    const loaded = loadSession(staged, 'IMP-0001');
    expect(rollbackSession(loaded, 'IMP-0001').batches[0].status).toBe('rolled back');
    const eq = loaded.equipment.find((e) => e.tag === 'AHU-3')!;
    const edited = applyChange(loaded, { entity: 'equipment', op: 'update', key: 'AHU-3', patch: { pfc: [true, ...eq.pfc.slice(1)] } }, { batchId: null });
    expect(rollbackSession(edited, 'IMP-0001')).toBe(edited);
  });
});
