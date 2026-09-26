import type { ColumnMapping, Field, System } from '../types';
import { FIELDS, SYSTEMS } from '../types';
import { isKnownType, normalizeTag, systemFor, typeOf } from '../data/tags';

export interface TransformedRow {
  rowNum: number; sourceTag: string; tag: string; values: Partial<Record<Field, string>>;
  type: string; system: System; systemFromColumn: boolean; notes: string[]; warnings: string[]; blank: boolean;
}

const LABEL: Record<Field, string> = { tag: 'Tag', desc: 'Description', location: 'Location', mfr: 'Manufacturer', model: 'Model', serial: 'Serial', system: 'System' };

export const cleanText = (s: string) => s.replace(/\s+/g, ' ').trim();

export function transformRows(grid: string[][], headerRow: number, headers: string[], mapping: ColumnMapping): TransformedRow[] {
  const col: Partial<Record<Field, number>> = {};
  for (const f of FIELDS) {
    const h = mapping[f];
    if (h !== null) { const i = headers.indexOf(h); if (i !== -1) col[f] = i; }
  }
  return grid.slice(headerRow + 1).map((cells, idx) => {
    const rowNum = idx + 1;
    const notes: string[] = [];
    const warnings: string[] = [];
    const blank = cells.every((c) => (c ?? '').trim() === '');
    const raw = (f: Field) => (col[f] === undefined ? '' : cells[col[f]!] ?? '');
    const sourceTag = raw('tag');
    const tag = normalizeTag(sourceTag);
    if (tag && tag !== cleanText(sourceTag)) notes.push(`Tag normalized: "${sourceTag.trim()}" → "${tag}"`);
    const values: Partial<Record<Field, string>> = {};
    if (tag) values.tag = tag;
    for (const f of ['desc', 'location', 'mfr', 'model', 'serial'] as const) {
      const r = raw(f);
      const v = cleanText(r);
      if (v !== r && v !== '') notes.push(`${LABEL[f]} cleaned: "${r}" → "${v}"`);
      if (v) values[f] = v;
    }
    const type = typeOf(tag);
    const sysRaw = cleanText(raw('system')).toLowerCase();
    const fromColumn = SYSTEMS.find((s) => s.toLowerCase() === sysRaw);
    const system = fromColumn ?? systemFor(type);
    if (fromColumn) values.system = fromColumn;
    if (tag && !isKnownType(type) && !fromColumn) warnings.push(`Unknown prefix "${type}"; loads as Unassigned`);
    return { rowNum, sourceTag, tag, values, type, system, systemFromColumn: Boolean(fromColumn), notes, warnings, blank };
  });
}
