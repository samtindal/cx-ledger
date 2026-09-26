import { describe, it, expect } from 'vitest';
import { registerRows, registerCsv, type RegisterFilter } from './register';
import { seedState } from '../data/seed';

const s = seedState(new Date(2026, 8, 26, 12));
const f = (over: Partial<RegisterFilter> = {}): RegisterFilter => ({ q: '', system: 'all', type: 'all', state: 'all', ...over });
const tags = (rows: ReturnType<typeof registerRows>) => rows.map((r) => r.eq.tag);

describe('registerRows', () => {
  it('returns all 27 units by default', () => expect(registerRows(s, f())).toHaveLength(27));
  it('filters by state', () => {
    expect(tags(registerRows(s, f({ state: 'fptFailed' })))).toEqual(['AHU-2', 'P-3', 'ATS-1']);
    expect(registerRows(s, f({ state: 'ready' }))).toHaveLength(11);
    expect(registerRows(s, f({ state: 'pfcIncomplete' }))).toHaveLength(9);
    expect(registerRows(s, f({ state: 'hasOpenIssues' }))).toHaveLength(10);
    expect(registerRows(s, f({ state: 'missingTab' }))).toHaveLength(18);
  });
  it('filters by system, type, search, and preset tags', () => {
    expect(registerRows(s, f({ system: 'Controls' }))).toHaveLength(2);
    expect(tags(registerRows(s, f({ type: 'VAV' })))).toEqual(['VAV-1-01', 'VAV-1-02', 'VAV-2-01']);
    expect(tags(registerRows(s, f({ q: 'boiler 103' })))).toEqual(['B-1', 'B-2', 'P-3', 'P-4']);
    expect(tags(registerRows(s, f({ q: 'greenheck' })))).toEqual(['EF-1', 'EF-2', 'EF-3']);
    expect(tags(registerRows(s, f({ tags: ['P-1', 'AHU-1'] })))).toEqual(['AHU-1', 'P-1']);
  });
  it('computes row stats', () => {
    const ahu2 = registerRows(s, f()).find((r) => r.eq.tag === 'AHU-2')!;
    expect(ahu2).toMatchObject({ pfcDone: 7, pfcTotal: 7, pfc: 'Complete', openIssues: 3, docs: 1, readiness: 'Blocked' });
  });
  it('exports CSV', () => {
    const csv = registerCsv(registerRows(s, f({ tags: ['AHU-1'] })));
    expect(csv.split('\r\n')).toEqual([
      'Tag,Description,Type,System,Location,Mfr,Model,Serial,PFC,FPT,Open issues,Docs,Readiness',
      'AHU-1,"Air handling unit, admin wing",AHU,Air side,Mech 101,Trane,CSAA021,K22H4410,7/7,Passed,0,0,Ready',
    ]);
  });
});
