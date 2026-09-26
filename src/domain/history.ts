import type { AppState, ChangeRecord } from '../types';

export const FIELD_LABELS: Record<string, string> = {
  pfc: 'checklist', fpt: 'FPT', fptDate: 'FPT date', desc: 'description', location: 'location', mfr: 'manufacturer',
  model: 'model', serial: 'serial', system: 'system', closed: 'closed', tag: 'tag', kind: 'kind',
};

export function historyFor(s: AppState, entity: ChangeRecord['entity'], key: string): ChangeRecord[] {
  return s.changes.filter((r) => r.entity === entity && r.key === key).reverse();
}

const fmt = (v: unknown): string => {
  if (Array.isArray(v) && v.every((x) => typeof x === 'boolean')) return `${v.filter(Boolean).length}/${v.length}`;
  return JSON.stringify(v ?? '');
};

export function describeChange(r: ChangeRecord): string {
  if (r.op === 'create') return 'created';
  if (r.op === 'delete') return 'deleted';
  const label = FIELD_LABELS[r.field ?? ''] ?? r.field ?? '';
  return `${label}: ${fmt(r.before)} → ${fmt(r.after)}`;
}
