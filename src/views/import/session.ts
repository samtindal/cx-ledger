import type { AppState, ColumnMapping, Field, ImportBatch, LoadReport, MappingProfile, SheetGrid } from '../../types';
import { FIELDS } from '../../types';
import { detectHeader, preselectSheet } from '../../etl/detectHeader';
import { autoMap } from '../../etl/fuzzy';
import { applyProfile, matchProfile, touchProfile } from '../../etl/profiles';
import { runPipeline, buildBatch } from '../../etl/stage';
import { loadBatch, nextBatchId, stageBatch, updateStaged } from '../../etl/load';
import { rollbackBatch } from '../../etl/rollback';

export function startSession(s: AppState, src: { source: string; origin: 'csv' | 'xlsx'; sheets: SheetGrid[] }, now = new Date().toISOString()): AppState {
  const sheetIndex = preselectSheet(src.sheets, s.profiles);
  const sheet = src.sheets[sheetIndex];
  const r = runPipeline({ grid: sheet.rows, register: s.equipment, profiles: s.profiles });
  const batch = buildBatch(r, {
    id: nextBatchId(s.batches), source: src.source, origin: src.origin, createdAt: now,
    sheetName: src.origin === 'xlsx' ? sheet.sheetName : undefined, input: { sheets: src.sheets, sheetIndex },
  });
  return stageBatch(s, batch);
}

export function restage(s: AppState, id: string, change: { sheetIndex?: number; headerRow?: number; mapping?: ColumnMapping }): AppState {
  return updateStaged(s, id, (b) => {
    if (!b.input) return b;
    const sheetIndex = change.sheetIndex ?? b.input.sheetIndex;
    const sheetChanged = change.sheetIndex !== undefined && change.sheetIndex !== b.input.sheetIndex;
    const sheet = b.input.sheets[sheetIndex];
    const r = runPipeline({
      grid: sheet.rows, register: s.equipment, profiles: s.profiles,
      headerRowOverride: sheetChanged ? undefined : change.headerRow ?? (change.mapping ? b.headerRow : undefined),
      mappingOverride: sheetChanged || change.headerRow !== undefined ? undefined : change.mapping,
    });
    const prior = new Map(b.rows.map((row) => [`${row.rowNum}:${row.tag}`, row.approved]));
    const rows = r.rows.map((row) => {
      const was = prior.get(`${row.rowNum}:${row.tag}`);
      return was === undefined || !['new', 'update', 'duplicate'].includes(row.result) ? row : { ...row, approved: was };
    });
    const next = buildBatch({ ...r, rows }, { id: b.id, source: b.source, origin: b.origin, createdAt: b.createdAt, sheetName: b.origin === 'xlsx' ? sheet.sheetName : undefined, input: { sheets: b.input.sheets, sheetIndex } });
    return next;
  });
}

export function stepSummary(b: ImportBatch, r?: LoadReport): { label: string; value: string }[] {
  const dataRows = b.rows.length;
  const mapped = new Set(Object.values(b.mapping).filter(Boolean)).size;
  const total = b.headers.filter(Boolean).length;
  const normalized = b.rows.filter((x) => x.notes.some((n) => n.startsWith('Tag normalized'))).length;
  const warnings = b.rows.reduce((n, x) => n + x.warnings.length, 0);
  const errors = b.counts.error;
  const approved = b.rows.filter((x) => x.approved).length;
  const report = r ?? b.loadReport;
  const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`;
  return [
    { label: 'Extract', value: `${dataRows} rows${b.skippedTitleRows ? ` · ${b.skippedTitleRows} title rows skipped` : ''}` },
    { label: 'Map', value: `${mapped}/${total} columns` },
    { label: 'Transform', value: `${plural(normalized, 'tag')} normalized` },
    { label: 'Validate', value: `${plural(errors, 'error')}, ${plural(warnings, 'warning')}` },
    { label: 'Review', value: `${approved} approved` },
    { label: 'Load', value: report ? `${report.created.length} new, ${report.updated.length} updated` : '—' },
  ];
}

/** Mapping-panel facts that the batch doesn't store: header confidence, per-field match confidence, profile match. */
export function mappingDetails(s: AppState, b: ImportBatch): {
  headerConfident: boolean;
  confidence: Record<Field, number | null>;
  profile: { profile: MappingProfile; mode: 'applied' | 'suggested' } | null;
} {
  const sheet = b.input?.sheets[b.input.sheetIndex];
  const detected = sheet ? detectHeader(sheet.rows) : null;
  const headerConfident = !detected || detected.confident || detected.headerRow !== b.headerRow;
  const applied = b.profileId ? s.profiles.find((p) => p.id === b.profileId) : undefined;
  const auto = autoMap(b.headers);
  const confidence = Object.fromEntries(FIELDS.map((f) => {
    if (b.mapping[f] === null) return [f, null];
    if (applied) return [f, 1];
    return [f, auto.mapping[f] === b.mapping[f] ? auto.confidence[f] : null];
  })) as Record<Field, number | null>;
  const match = matchProfile(b.headers, s.profiles);
  const profile = applied ? { profile: applied, mode: 'applied' as const } : match && { profile: match.profile, mode: 'suggested' as const };
  return { headerConfident, confidence, profile };
}

/** Re-stages the batch with a suggested profile's mapping and records the profile on the batch. */
export function applySuggestedProfile(s: AppState, id: string, profileId: string): AppState {
  const b = s.batches.find((x) => x.id === id && x.status === 'staged');
  const p = s.profiles.find((x) => x.id === profileId);
  if (!b || !p) return s;
  const next = restage(s, id, { mapping: applyProfile(p, b.headers) });
  return updateStaged(next, id, (x) => ({ ...x, profileId }));
}

/** Loads a staged batch and marks its profile as used. A no-op when the batch is no longer staged. */
export function loadSession(s: AppState, id: string, at = new Date().toISOString()): AppState {
  const b = s.batches.find((x) => x.id === id && x.status === 'staged');
  if (!b) return s;
  const { state } = loadBatch(s, id, { at });
  return b.profileId ? touchProfile(state, b.profileId, at) : state;
}

/** Rolls back a loaded batch. A no-op when the batch isn't loaded or rollback is blocked by later edits. */
export function rollbackSession(s: AppState, id: string): AppState {
  if (!s.batches.some((b) => b.id === id && b.status === 'loaded')) return s;
  const r = rollbackBatch(s, id);
  return r.ok ? r.state : s;
}
