import { describe, it, expect } from 'vitest';
import { parseCsv, detectDelimiter } from '../parseCsv';
import { loadFixtureText } from './fixtures';

describe('parseCsv', () => {
  it('handles quoted commas, escaped quotes, and embedded newlines', () => {
    expect(parseCsv('a,"b,c","say ""hi""","x\ny"\n')).toEqual([['a', 'b,c', 'say "hi"', 'x\ny']]);
  });
  it('handles CRLF and no trailing newline', () => {
    expect(parseCsv('a,b\r\nc,d')).toEqual([['a', 'b'], ['c', 'd']]);
  });
  it('does not emit a row for the trailing newline', () => {
    expect(parseCsv('a\n')).toEqual([['a']]);
  });
  it('keeps empty fields and all-empty rows', () => {
    expect(parseCsv('a,,\n,,\n')).toEqual([['a', '', ''], ['', '', '']]);
  });
  it('strips a UTF-8 BOM (Review Focus #2)', () => {
    expect(parseCsv('﻿Equip Tag,Loc.\nAHU-1,Roof\n')[0][0]).toBe('Equip Tag');
  });
  it('auto-detects tab-separated paste from Excel (Review Focus #1)', () => {
    expect(detectDelimiter('Tag\tDescription\nAHU-1\tAir, handler')).toBe('\t');
    expect(parseCsv('Tag\tDescription\nAHU-1\tAir, handler\n')).toEqual([['Tag', 'Description'], ['AHU-1', 'Air, handler']]);
  });
  it('parses the golden fixture into 13 rows of 6 cells', () => {
    const rows = parseCsv(loadFixtureText('contractor-export.csv'));
    expect(rows).toHaveLength(13);
    expect(rows.every((r) => r.length === 6)).toBe(true);
    expect(rows[7][1]).toBe('Dry-type transformer, 75 kVA');
    expect(rows[3][1]).toBe(' Fume hood exhaust fan ');
  });
});
