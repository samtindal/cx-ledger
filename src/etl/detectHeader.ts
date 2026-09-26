import type { MappingProfile, SheetGrid } from '../types';
import { bestFieldScore } from './fuzzy';
import { matchProfile } from './profiles';

export function scoreHeaderRow(row: string[]): number {
  const cells = row.map((c) => c.trim()).filter(Boolean);
  if (cells.length === 0) return 0;
  const matches = cells.filter((c) => bestFieldScore(c) > 0).length;
  const short = cells.filter((c) => c.length <= 30 && !/^[\d.,\s-]+$/.test(c)).length;
  return matches + (short / cells.length >= 0.6 ? 0.5 : 0);
}

export function detectHeader(rows: string[][], maxScan = 15) {
  let best = { row: -1, score: 0 };
  rows.slice(0, maxScan).forEach((r, i) => {
    const score = scoreHeaderRow(r);
    if (score > best.score) best = { row: i, score };
  });
  if (best.score < 2) return { headerRow: 0, score: best.score, skippedTitleRows: 0, confident: false };
  return { headerRow: best.row, score: best.score, skippedTitleRows: best.row, confident: true };
}

export function preselectSheet(sheets: SheetGrid[], profiles: MappingProfile[]): number {
  const detected = sheets.map((s) => detectHeader(s.rows));
  const byProfile = sheets.findIndex((s, i) => {
    const m = detected[i].confident ? matchProfile(s.rows[detected[i].headerRow] ?? [], profiles) : null;
    return m !== null && m.profile.sheetName === s.sheetName;
  });
  if (byProfile !== -1) return byProfile;
  let best = 0;
  detected.forEach((d, i) => { if (d.score > detected[best].score) best = i; });
  return best;
}
