import { describe, it, expect } from 'vitest';
import { readWorkbook } from '../readWorkbook';
import { loadFixtureBytes } from './fixtures';

describe('readWorkbook', () => {
  const sheets = readWorkbook(loadFixtureBytes('contractor-schedule.xlsx'));
  it('returns every sheet by name in order', () => {
    expect(sheets.map((s) => s.sheetName)).toEqual(['Notes', 'Equipment Schedule']);
  });
  it('fills merged ranges before returning rows', () => {
    const rows = sheets[1].rows;
    expect(rows[0].every((c) => c === 'KETTLE CREEK WTP — MECHANICAL EQUIPMENT SCHEDULE')).toBe(true);
    expect(rows[3]).toEqual(['Equip Tag', 'EQUIPMENT DESCRIPTION', 'Loc.', 'Mfr', 'Model #', 'Serial #']);
  });
  it('keeps the blank data row and returns display text', () => {
    const rows = sheets[1].rows;
    expect(rows).toHaveLength(4 + 12);
    expect(rows[9]).toEqual(['', '', '', '', '', '']);
    expect(rows[6][5]).toBe('23-118842');
  });
});
