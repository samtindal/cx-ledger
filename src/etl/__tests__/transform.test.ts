import { describe, it, expect } from 'vitest';
import { transformRows, cleanText } from '../transform';
import { autoMap } from '../fuzzy';

const headers = ['Tag', 'Description', 'System'];
const map = autoMap(headers).mapping;

describe('transformRows', () => {
  it('cleans text and notes changes', () => {
    expect(cleanText('  a   b \t c ')).toBe('a b c');
    const [r] = transformRows([headers, ['ahu 3', ' Air  handler ', '']], 0, headers, map);
    expect(r).toMatchObject({ rowNum: 1, sourceTag: 'ahu 3', tag: 'AHU-3', type: 'AHU', system: 'Air side', systemFromColumn: false, blank: false });
    expect(r.values).toEqual({ tag: 'AHU-3', desc: 'Air handler' });
    expect(r.notes).toEqual(['Tag normalized: "ahu 3" → "AHU-3"', 'Description cleaned: " Air  handler " → "Air handler"']);
  });
  it('uses a valid system column, else the registry', () => {
    const rows = transformRows([headers, ['P-9', 'Pump', 'electrical'], ['P-8', 'Pump', 'Mechanical']], 0, headers, map);
    expect(rows[0]).toMatchObject({ system: 'Electrical', systemFromColumn: true });
    expect(rows[0].values.system).toBe('Electrical');
    expect(rows[1]).toMatchObject({ system: 'Hydronic', systemFromColumn: false });
    expect(rows[1].values.system).toBeUndefined();
    expect(rows[0].notes).toEqual(['System cleaned: "electrical" → "Electrical"']);
    expect(rows[0].warnings).toEqual([]);
    expect(rows[1].notes).toEqual([]);
    expect(rows[1].warnings).toEqual(['Unknown system "Mechanical"; using Hydronic from tag registry']);
    const [exact] = transformRows([headers, ['P-7', 'Pump', 'Hydronic']], 0, headers, map);
    expect(exact).toMatchObject({ system: 'Hydronic', systemFromColumn: true, notes: [], warnings: [] });
  });
  it('flags blanks and unknown prefixes', () => {
    const rows = transformRows([headers, ['', ' ', ''], ['ZZ-9', 'Spare', '']], 0, headers, map);
    expect(rows[0].blank).toBe(true);
    expect(rows[1]).toMatchObject({ system: 'Unassigned', warnings: ['Unknown prefix "ZZ"; loads as Unassigned'] });
  });
});
