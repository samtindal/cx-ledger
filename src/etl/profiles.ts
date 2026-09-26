import type { AppState, ColumnMapping, MappingProfile } from '../types';
import { FIELDS } from '../types';
import { emptyMapping, normalizeHeader } from './fuzzy';

const normSet = (headers: string[]) => new Set(headers.map(normalizeHeader).filter(Boolean));

export function headerSignature(headers: string[]): string {
  return [...normSet(headers)].sort().join('|');
}

export function matchProfile(headers: string[], profiles: MappingProfile[]) {
  const sig = headerSignature(headers);
  const exact = profiles.filter((p) => p.headerSignature === sig).sort((a, b) => b.lastUsed.localeCompare(a.lastUsed));
  if (exact.length) return { profile: exact[0], mode: 'applied' as const };
  const mine = normSet(headers);
  let best: { profile: MappingProfile; overlap: number } | null = null;
  for (const p of profiles) {
    const theirs = new Set(p.headerSignature.split('|').filter(Boolean));
    const shared = [...mine].filter((h) => theirs.has(h)).length;
    const overlap = shared / Math.max(mine.size, theirs.size, 1);
    if (overlap >= 0.8 && (!best || overlap > best.overlap)) best = { profile: p, overlap };
  }
  return best ? { profile: best.profile, mode: 'suggested' as const } : null;
}

export function applyProfile(profile: MappingProfile, headers: string[]): ColumnMapping {
  const out = emptyMapping();
  for (const f of FIELDS) {
    const want = profile.columns[f];
    if (want === null) continue;
    out[f] = headers.find((h) => normalizeHeader(h) === normalizeHeader(want)) ?? null;
  }
  return out;
}

export function createProfile(p: { name: string; headers: string[]; mapping: ColumnMapping; headerRow: number; sheetName?: string; now?: string; existing: MappingProfile[] }): MappingProfile {
  const max = p.existing.reduce((m, x) => Math.max(m, Number(/^PRF-(\d+)$/.exec(x.id)?.[1] ?? 0)), 0);
  return {
    id: `PRF-${String(max + 1).padStart(4, '0')}`,
    name: p.name.trim() || 'Untitled profile',
    headerSignature: headerSignature(p.headers),
    sheetName: p.sheetName,
    headerRow: p.headerRow,
    columns: { ...p.mapping },
    lastUsed: p.now ?? new Date().toISOString(),
  };
}

export const addProfile = (s: AppState, p: MappingProfile): AppState => ({ ...s, profiles: [...s.profiles, p] });
export const renameProfile = (s: AppState, id: string, name: string): AppState =>
  ({ ...s, profiles: s.profiles.map((p) => (p.id === id ? { ...p, name } : p)) });
export const deleteProfile = (s: AppState, id: string): AppState => ({ ...s, profiles: s.profiles.filter((p) => p.id !== id) });
export const touchProfile = (s: AppState, id: string, at: string): AppState =>
  ({ ...s, profiles: s.profiles.map((p) => (p.id === id ? { ...p, lastUsed: at } : p)) });
