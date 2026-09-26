import type { AppState, Equipment, ImportBatch, LoadReport, StagedRow } from '../types';
import { applyChange } from '../state/applyChange';
import { checklistFor } from '../data/checklists';
import { diffAgainst, countRows } from './stage';

export function nextBatchId(batches: ImportBatch[]): string {
  const max = batches.reduce((m, b) => Math.max(m, Number(/^IMP-(\d+)$/.exec(b.id)?.[1] ?? 0)), 0);
  return `IMP-${String(max + 1).padStart(4, '0')}`;
}

export const stageBatch = (s: AppState, b: ImportBatch): AppState =>
  ({ ...s, batches: [...s.batches.filter((x) => x.status !== 'staged'), b] });

export const updateStaged = (s: AppState, id: string, fn: (b: ImportBatch) => ImportBatch): AppState =>
  ({ ...s, batches: s.batches.map((b) => (b.id === id && b.status === 'staged' ? fn(b) : b)) });

const APPROVABLE = new Set(['new', 'update', 'duplicate']);

export const setApproval = (s: AppState, id: string, rowNum: number, approved: boolean) =>
  updateStaged(s, id, (b) => ({ ...b, rows: b.rows.map((r) => (r.rowNum === rowNum && APPROVABLE.has(r.result) ? { ...r, approved } : r)) }));
export const approveAll = (s: AppState, id: string) =>
  updateStaged(s, id, (b) => ({ ...b, rows: b.rows.map((r) => (r.result === 'new' || r.result === 'update' ? { ...r, approved: true } : r)) }));
export const clearAll = (s: AppState, id: string) =>
  updateStaged(s, id, (b) => ({ ...b, rows: b.rows.map((r) => ({ ...r, approved: false })) }));
export const discardStaged = (s: AppState, id: string): AppState =>
  ({ ...s, batches: s.batches.filter((b) => !(b.id === id && b.status === 'staged')) });

export function newEquipmentFromRow(row: StagedRow): Equipment {
  const v = row.values;
  return {
    tag: row.tag, type: row.type, desc: v.desc ?? '', system: row.system,
    location: v.location ?? '', mfr: v.mfr ?? '', model: v.model ?? '', serial: v.serial ?? '',
    pfc: checklistFor(row.type, row.system).map(() => false), fpt: 'Not started',
  };
}

export function loadBatch(s: AppState, id: string, meta: { at?: string } = {}): { state: AppState; report: LoadReport } {
  const batch = s.batches.find((b) => b.id === id && b.status === 'staged');
  if (!batch) throw new Error(`No staged batch ${id}`);
  const at = meta.at ?? new Date().toISOString();
  const report: LoadReport = { created: [], updated: [], unchanged: [], skipped: 0 };
  const approved = batch.rows.filter((r) => r.approved && APPROVABLE.has(r.result));
  const ordered = [...approved.filter((r) => r.result !== 'duplicate'), ...approved.filter((r) => r.result === 'duplicate')];
  report.skipped = batch.rows.filter((r) => !r.approved && r.result !== 'blank').length;
  let state = s;
  for (const row of ordered) {
    const current = state.equipment.find((e) => e.tag === row.tag);
    if (!current) {
      state = applyChange(state, { entity: 'equipment', op: 'create', value: newEquipmentFromRow(row) }, { batchId: id, at });
      report.created.push(row.tag);
      continue;
    }
    const diff = diffAgainst(row.values, current);
    if (diff.length === 0) { report.unchanged.push(row.tag); continue; }
    const patch = Object.fromEntries(diff.map((d) => [d.field, d.after])) as Partial<Equipment>;
    state = applyChange(state, { entity: 'equipment', op: 'update', key: row.tag, patch }, { batchId: id, at });
    if (!report.updated.includes(row.tag) && !report.created.includes(row.tag)) report.updated.push(row.tag);
  }
  state = {
    ...state,
    batches: state.batches.map((b) => (b.id === id
      ? { ...b, status: 'loaded' as const, loadedAt: at, loadReport: report, input: undefined, counts: countRows(b.rows) }
      : b)),
  };
  return { state, report };
}
