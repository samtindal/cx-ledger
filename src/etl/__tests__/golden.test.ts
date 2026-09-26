import { describe, it, expect } from 'vitest';
import { runPipeline, type PipelineResult } from '../stage';
import { parseCsv } from '../parseCsv';
import { readWorkbook } from '../readWorkbook';
import { preselectSheet } from '../detectHeader';
import { createProfile } from '../profiles';
import { buildSeed } from '../../data/seed';
import { loadFixtureBytes, loadFixtureText } from './fixtures';

const register = buildSeed(new Date(2026, 8, 26, 12)).equipment;
const csvGrid = parseCsv(loadFixtureText('contractor-export.csv'));
const sheets = readWorkbook(loadFixtureBytes('contractor-schedule.xlsx'));
const xlsxGrid = sheets[preselectSheet(sheets, [])].rows;

const project = (r: PipelineResult) =>
  r.rows.map(({ rowNum, tag, result, type, system, values, diff, notes, warnings, approved }) =>
    ({ rowNum, tag, result, type, system, values, diff, notes, warnings, approved }));
const tagsOf = (r: PipelineResult, res: string) => r.rows.filter((x) => x.result === res).map((x) => x.tag).sort();

describe('golden: contractor-export.csv against the seed register', () => {
  const r = runPipeline({ grid: csvGrid, register });

  it('maps 6/6 columns and reads 12 data rows', () => {
    expect(r).toMatchObject({ headerRow: 0, skippedTitleRows: 0, extracted: 12, mappedColumns: 6, totalColumns: 6, normalizedTags: 5 });
  });
  it('buckets rows exactly as the spec says', () => {
    expect(r.counts).toEqual({ new: 7, update: 2, noChange: 0, duplicate: 1, error: 1, blank: 1 });
    expect(tagsOf(r, 'new')).toEqual(['AHU-3', 'CH-2', 'EF-4', 'P-5', 'VAV-2-15', 'XFMR-T1', 'ZZ-9']);
    expect(tagsOf(r, 'update')).toEqual(['AHU-1', 'GEN-1']);
  });
  it('keeps the AHU-3 row with the serial and marks the first as duplicate', () => {
    const ahu3 = r.rows.filter((x) => x.tag === 'AHU-3');
    expect(ahu3.map((x) => [x.rowNum, x.result])).toEqual([[1, 'duplicate'], [2, 'new']]);
    expect(ahu3[0].notes).toContain('Duplicate of row 2');
    expect(ahu3[0].approved).toBe(false);
    expect(ahu3[1].values).toMatchObject({ desc: 'Air handling unit - lab makeup air', serial: 'K23J8812' });
  });
  it('diffs updates field by field', () => {
    const ahu1 = r.rows.find((x) => x.tag === 'AHU-1')!;
    expect(ahu1.diff).toEqual([
      { field: 'desc', before: 'Air handling unit, admin wing', after: 'Air handling unit - admin wing' },
      { field: 'location', before: 'Mech 101', after: 'Mech Rm 101' },
      { field: 'serial', before: 'K22H4410', after: 'K22H4410-R' },
    ]);
    const gen1 = r.rows.find((x) => x.tag === 'GEN-1')!;
    expect(gen1.diff).toEqual([{ field: 'serial', before: '', after: 'CAT00C9XK' }]);
    expect(gen1.warnings).toContain('Blank description; keeping register value');
    expect(gen1.notes).toContain('Tag normalized: "gen1" → "GEN-1"');
  });
  it('derives type/system and warns on unknown prefixes', () => {
    const by = Object.fromEntries(r.rows.filter((x) => x.tag).map((x) => [x.tag, x]));
    expect(by['VAV-2-15']).toMatchObject({ type: 'VAV', system: 'Air side' });
    expect(by['XFMR-T1']).toMatchObject({ type: 'XFMR', system: 'Electrical' });
    expect(by['CH-2']).toMatchObject({ system: 'Hydronic' });
    expect(by['ZZ-9']).toMatchObject({ system: 'Unassigned', warnings: ['Unknown prefix "ZZ"; loads as Unassigned'] });
    expect(by['EF-4'].values.desc).toBe('Fume hood exhaust fan');
  });
  it('rejects the missing-tag row and skips the blank', () => {
    expect(r.rows.find((x) => x.rowNum === 12)).toMatchObject({ result: 'error', tag: '', notes: ['Missing tag'], approved: false });
    expect(r.rows.find((x) => x.rowNum === 6)).toMatchObject({ result: 'blank' });
  });
  it('approves new + update by default', () => {
    expect(r.rows.filter((x) => x.approved).map((x) => x.tag).sort())
      .toEqual(['AHU-1', 'AHU-3', 'CH-2', 'EF-4', 'GEN-1', 'P-5', 'VAV-2-15', 'XFMR-T1', 'ZZ-9']);
  });
});

describe('golden: contractor-schedule.xlsx produces the identical result', () => {
  const csv = runPipeline({ grid: csvGrid, register });
  const xlsx = runPipeline({ grid: xlsxGrid, register });
  it('skips 3 title rows', () => {
    expect(xlsx).toMatchObject({ headerRow: 3, skippedTitleRows: 3, mappedColumns: 6 });
  });
  it('matches the CSV row for row', () => {
    expect(project(xlsx)).toEqual(project(csv));
    expect(xlsx.counts).toEqual(csv.counts);
  });
});

describe('profiles in the pipeline', () => {
  it('a profile saved from the CSV auto-applies to reordered headers', () => {
    const csv = runPipeline({ grid: csvGrid, register });
    const profile = createProfile({ name: 'Acme', headers: csv.headers, mapping: csv.mapping, headerRow: 0, existing: [], now: '2026-09-26T00:00:00Z' });
    const order = [5, 2, 0, 4, 3, 1];
    const reordered = csvGrid.map((row) => order.map((i) => row[i]));
    const r = runPipeline({ grid: reordered, register, profiles: [profile] });
    expect(r.profile).toEqual({ profile, mode: 'applied' });
    expect(r.counts).toEqual(csv.counts);
    expect(r.confidence.tag).toBe(1);
  });
  it('honors a manual mapping override', () => {
    const csv = runPipeline({ grid: csvGrid, register });
    const r = runPipeline({ grid: csvGrid, register, mappingOverride: { ...csv.mapping, desc: null } });
    expect(r.counts.error).toBe(8); // 7 new rows now lack a description, plus the missing-tag row
  });
});
