import * as XLSX from 'xlsx';
import type { SheetGrid } from '../types';

export function fillMerges(ws: XLSX.WorkSheet): void {
  for (const m of ws['!merges'] ?? []) {
    const src = ws[XLSX.utils.encode_cell(m.s)];
    if (!src) continue;
    for (let r = m.s.r; r <= m.e.r; r++) {
      for (let c = m.s.c; c <= m.e.c; c++) {
        if (r === m.s.r && c === m.s.c) continue;
        ws[XLSX.utils.encode_cell({ r, c })] = { ...src };
      }
    }
  }
}

export function readWorkbook(data: ArrayBuffer | Uint8Array): SheetGrid[] {
  const wb = XLSX.read(data instanceof Uint8Array ? data : new Uint8Array(data), { type: 'array' });
  return wb.SheetNames.map((sheetName) => {
    const ws = wb.Sheets[sheetName];
    fillMerges(ws);
    const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: false, defval: '', blankrows: true });
    const width = rows.reduce((max, r) => Math.max(max, r.length), 0);
    return {
      sheetName,
      rows: rows.map((r) => Array.from({ length: width }, (_, i) => String(r[i] ?? ''))),
    };
  });
}
