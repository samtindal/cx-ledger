import { describe, it, expect } from 'vitest';
import { detectHeader, preselectSheet } from '../detectHeader';
import { parseCsv } from '../parseCsv';
import { readWorkbook } from '../readWorkbook';
import { loadFixtureBytes, loadFixtureText } from './fixtures';

describe('detectHeader', () => {
  it('finds row 0 in the CSV', () => {
    expect(detectHeader(parseCsv(loadFixtureText('contractor-export.csv')))).toMatchObject({ headerRow: 0, skippedTitleRows: 0, confident: true });
  });
  it('skips 3 title rows in the xlsx', () => {
    const sheet = readWorkbook(loadFixtureBytes('contractor-schedule.xlsx'))[1];
    expect(detectHeader(sheet.rows)).toMatchObject({ headerRow: 3, skippedTitleRows: 3, confident: true });
  });
  it('is not confident when nothing looks like a header', () => {
    expect(detectHeader([['hello', 'world'], ['1', '2']])).toMatchObject({ headerRow: 0, confident: false });
  });
  it('preselects the schedule sheet, not the first sheet', () => {
    expect(preselectSheet(readWorkbook(loadFixtureBytes('contractor-schedule.xlsx')), [])).toBe(1);
  });
});
