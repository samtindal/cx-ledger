import type { AppState, ChangeRecord } from '../types';
import { applyChange, type Change } from '../state/applyChange';
import { FIELD_LABELS } from '../domain/history';

export interface RollbackConflict { key: string; fields: string[]; count: number; message: string }

export function findRollbackConflicts(s: AppState, id: string): RollbackConflict[] {
  const own = s.changes.map((c, i) => [c, i] as const).filter(([c]) => c.batchId === id);
  if (own.length === 0) return [];
  const lastIdx = own[own.length - 1][1];
  const touched = new Set(own.map(([c]) => `${c.entity}:${c.key}`));
  const rolledBack = new Set(s.batches.filter((b) => b.status === 'rolled back').map((b) => b.id));
  const later = s.changes.slice(lastIdx + 1).filter((c) =>
    c.batchId !== id && !(c.batchId && rolledBack.has(c.batchId)) && touched.has(`${c.entity}:${c.key}`));
  const groups = new Map<string, ChangeRecord[]>();
  for (const c of later) groups.set(c.key, [...(groups.get(c.key) ?? []), c]);
  return [...groups].map(([key, recs]) => {
    const fields = [...new Set(recs.map((r) => (r.op === 'update' ? FIELD_LABELS[r.field ?? ''] ?? r.field ?? '' : r.op === 'create' ? 'created' : 'deleted')))];
    const count = recs.length;
    return { key, fields, count, message: `${key} was edited after this import (${fields.join(', ')}, ${count} ${count === 1 ? 'change' : 'changes'}). Roll back those first or keep the batch.` };
  });
}

function inverse(r: ChangeRecord): Change {
  const e = r.entity;
  if (r.op === 'create') return { entity: e, op: 'delete', key: r.key } as Change;
  if (r.op === 'delete') return { entity: e, op: 'create', value: r.before } as Change;
  return { entity: e, op: 'update', key: r.key, patch: { [r.field!]: r.before } } as Change;
}

export function rollbackBatch(s: AppState, id: string, meta: { at?: string } = {}):
  { ok: true; state: AppState } | { ok: false; conflicts: RollbackConflict[] } {
  const batch = s.batches.find((b) => b.id === id);
  if (!batch || batch.status !== 'loaded') throw new Error(`Batch ${id} is not loaded`);
  const conflicts = findRollbackConflicts(s, id);
  if (conflicts.length) return { ok: false, conflicts };
  const at = meta.at ?? new Date().toISOString();
  const records = s.changes.filter((c) => c.batchId === id).reverse();
  let state = records.reduce((acc, r) => applyChange(acc, inverse(r), { batchId: id, at }), s);
  state = { ...state, batches: state.batches.map((b) => (b.id === id ? { ...b, status: 'rolled back' as const, rolledBackAt: at } : b)) };
  return { ok: true, state };
}
