import type { ColumnMapping, Field } from '../types';
import { FIELDS } from '../types';

export const SYNONYMS: Record<Field, string[]> = {
  tag: ['tag', 'equiptag', 'equipmenttag', 'equipmentid', 'unittag', 'mark'],
  desc: ['description', 'equipmentdescription', 'desc', 'name', 'service'],
  location: ['location', 'loc', 'room', 'area'],
  mfr: ['mfr', 'manufacturer', 'make', 'basisofdesign'],
  model: ['model', 'modelno', 'modelnumber'],
  serial: ['serial', 'serialno', 'sn'],
  system: ['system', 'discipline'],
};

export const normalizeHeader = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

export function levenshtein(a: string, b: string): number {
  const prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = tmp;
    }
  }
  return prev[b.length];
}

export function similarity(h: string, syn: string): number {
  if (!h) return 0;
  if (h === syn) return 1;
  const [short, long] = h.length <= syn.length ? [h, syn] : [syn, h];
  let best = short.length >= 3 && long.includes(short) ? 0.8 : 0;
  const lev = 1 - levenshtein(h, syn) / Math.max(h.length, syn.length);
  if (lev >= 0.75 && lev > best) best = lev;
  return best;
}

export function fieldScore(header: string, field: Field): number {
  const h = normalizeHeader(header);
  return Math.max(0, ...SYNONYMS[field].map((s) => similarity(h, s)));
}

export function bestFieldScore(header: string): number {
  return Math.max(0, ...FIELDS.map((f) => fieldScore(header, f)));
}

export const emptyMapping = (): ColumnMapping =>
  ({ tag: null, desc: null, location: null, mfr: null, model: null, serial: null, system: null });

export function autoMap(headers: string[]) {
  const pairs: { h: number; f: Field; score: number }[] = [];
  headers.forEach((header, h) => FIELDS.forEach((f) => {
    const score = fieldScore(header, f);
    if (score > 0) pairs.push({ h, f, score });
  }));
  pairs.sort((a, b) => b.score - a.score || a.h - b.h || FIELDS.indexOf(a.f) - FIELDS.indexOf(b.f));
  const mapping = emptyMapping();
  const confidence = Object.fromEntries(FIELDS.map((f) => [f, null])) as Record<Field, number | null>;
  const used = new Set<number>();
  for (const p of pairs) {
    if (used.has(p.h) || mapping[p.f] !== null) continue;
    mapping[p.f] = headers[p.h];
    confidence[p.f] = p.score;
    used.add(p.h);
  }
  return { mapping, confidence };
}
