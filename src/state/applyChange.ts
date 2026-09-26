import type { AppState, ChangeRecord, DocumentRef, Equipment, Issue } from '../types';
import { deepEqual } from '../lib/equal';

export type Change =
  | { entity: 'equipment'; op: 'create'; value: Equipment }
  | { entity: 'equipment'; op: 'update'; key: string; patch: Partial<Equipment> }
  | { entity: 'equipment'; op: 'delete'; key: string }
  | { entity: 'issue'; op: 'create'; value: Issue }
  | { entity: 'issue'; op: 'update'; key: string; patch: Partial<Issue> }
  | { entity: 'issue'; op: 'delete'; key: string }
  | { entity: 'document'; op: 'create'; value: DocumentRef }
  | { entity: 'document'; op: 'update'; key: string; patch: Partial<DocumentRef> }
  | { entity: 'document'; op: 'delete'; key: string };

export interface ChangeMeta { batchId: string | null; at?: string; actor?: string }

type Entity = Change['entity'];
type Row = Record<string, unknown>;
const COLLECTION = { equipment: 'equipment', issue: 'issues', document: 'documents' } as const;
const KEY_FIELD: Record<Entity, string> = { equipment: 'tag', issue: 'id', document: 'id' };

const changeId = (n: number) => `CR-${String(n).padStart(5, '0')}`;

export function applyChange(state: AppState, change: Change, meta: ChangeMeta): AppState {
  const at = meta.at ?? new Date().toISOString();
  const actor = meta.actor ?? 'Demo user';
  const coll = COLLECTION[change.entity];
  const keyField = KEY_FIELD[change.entity];
  const list = state[coll] as unknown as Row[];
  const records: ChangeRecord[] = [];
  const record = (r: Pick<ChangeRecord, 'key' | 'op'> & Partial<ChangeRecord>) =>
    records.push({ id: changeId(state.changes.length + records.length + 1), batchId: meta.batchId, entity: change.entity, at, actor, ...r });

  let next: Row[];
  if (change.op === 'create') {
    const value = change.value as unknown as Row;
    const key = String(value[keyField]);
    if (list.some((x) => x[keyField] === key)) throw new Error(`${change.entity} ${key} already exists`);
    next = [...list, value];
    record({ key, op: 'create', after: value });
  } else {
    const idx = list.findIndex((x) => x[keyField] === change.key);
    if (idx === -1) throw new Error(`${change.entity} ${change.key} not found`);
    const current = list[idx];
    if (change.op === 'delete') {
      next = list.filter((_, i) => i !== idx);
      record({ key: change.key, op: 'delete', before: current });
    } else {
      const patch = change.patch as Row;
      if (keyField in patch && patch[keyField] !== change.key) throw new Error(`cannot change ${change.entity} key`);
      const updated: Row = { ...current };
      for (const [field, after] of Object.entries(patch)) {
        const before = current[field];
        if (deepEqual(before, after)) continue;
        updated[field] = after;
        record({ key: change.key, op: 'update', field, before, after });
      }
      if (records.length === 0) return state;
      next = list.map((x, i) => (i === idx ? updated : x));
    }
  }
  return { ...state, [coll]: next, changes: [...state.changes, ...records] };
}

export function applyChanges(state: AppState, changes: Change[], meta: ChangeMeta): AppState {
  return changes.reduce((s, c) => applyChange(s, c, meta), state);
}
