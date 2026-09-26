import type { System } from '../types';

const GROUPS: [System, string[]][] = [
  ['Air side', ['AHU', 'RTU', 'ERV', 'EF', 'SF', 'RF', 'VAV', 'FCU', 'UH']],
  ['Hydronic', ['CH', 'CT', 'B', 'P', 'HX']],
  ['Electrical', ['SWBD', 'MCC', 'PNL', 'ATS', 'GEN', 'UPS', 'VFD', 'XFMR']],
  ['Controls', ['BAS', 'LC']],
  ['Plumbing', ['DWH', 'WH']],
];

export const TAG_REGISTRY: Record<string, System> = Object.fromEntries(
  GROUPS.flatMap(([system, types]) => types.map((t) => [t, system])),
);

export function normalizeTag(raw: string): string {
  let t = raw.trim().toUpperCase();
  t = t.replace(/[\s_]+/g, '-');
  t = t.replace(/-{2,}/g, '-');
  t = t.replace(/^-+|-+$/g, '');
  t = t.replace(/^([A-Z]+)-?(\d)/, '$1-$2');
  return t.replace(/^-+|-+$/g, '');
}

export function typeOf(tag: string): string {
  return /^[A-Z]+/.exec(tag)?.[0] ?? '';
}

export function isKnownType(type: string): boolean {
  return type in TAG_REGISTRY;
}

export function systemFor(type: string): System {
  return TAG_REGISTRY[type] ?? 'Unassigned';
}
