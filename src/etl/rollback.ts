import type { AppState, ChangeRecord } from '../types';
import { applyChange, type Change } from '../state/applyChange';
import { FIELD_LABELS } from '../domain/history';

export interface RollbackConflict { key: string; fields: string[]; count: number; message: string }

export function findRollbackConflicts(s: AppState, id: string): RollbackConflict[] {
  const own = s.changes.map((c, i) => [c, i] as const).filter(([c]) => c.batchId === id);
  if (own.length === 0) return [];
  const lastIdx = own[own.length - 1][1];
  const touched = new Set(own.map(([c]) => `${c.entity}:${c.key}`));
  const createdUnits = new Set(own.filter(([c]) => c.entity === 'equipment' && c.op === 'create').map(([c]) => c.key));
  const rolledBack = new Set(s.batches.filter((b) => b.status === 'rolled back').map((b) => b.id));
  // Group each blocking record under the unit it affects: a direct edit to a touched record,
  // or an issue/document created on (or re-tagged to) a unit this batch created.
  const groups = new Map<string, string[]>(); // unit key -> one label per blocking record
  const add = (key: string, label: string) => groups.set(key, [...(groups.get(key) ?? []), label]);
  for (const c of s.changes.slice(lastIdx + 1)) {
    if (c.batchId === id || (c.batchId && rolledBack.has(c.batchId))) continue;
    if (touched.has(`${c.entity}:${c.key}`)) {
      add(c.key, c.op === 'update' ? FIELD_LABELS[c.field ?? ''] ?? c.field ?? '' : c.op === 'create' ? 'created' : 'deleted');
      continue;
    }
    const tag = dependentTag(c);
    if (tag !== undefined && createdUnits.has(tag)) add(tag, `${c.entity} ${c.key}`);
  }
  return [...groups].map(([key, labels]) => {
    const fields = [...new Set(labels)];
    const count = labels.length;
    return { key, fields, count, message: `${key} was edited after this import (${fields.join(', ')}, ${count} ${count === 1 ? 'change' : 'changes'}). Roll back those first or keep the batch.` };
  });
}

/** The unit tag an issue or document record points at, if it sets one. */
function dependentTag(c: ChangeRecord): string | undefined {
  if (c.entity === 'equipment') return undefined;
  if (c.op === 'create') {
    const tag = (c.after as { tag?: unknown } | undefined)?.tag;
    return typeof tag === 'string' ? tag : undefined;
  }
  if (c.op === 'update' && c.field === 'tag' && typeof c.after === 'string') return c.after;
  return undefined;
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
