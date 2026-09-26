import type { BatchCounts, ColumnMapping, Equipment, Field, FieldDiff, ImportBatch, MappingProfile, StagedRow } from '../types';
import { FIELDS } from '../types';
import { transformRows, type TransformedRow } from './transform';
import { detectHeader } from './detectHeader';
import { autoMap } from './fuzzy';
import { applyProfile, matchProfile } from './profiles';

export const DIFF_FIELDS: Field[] = ['desc', 'location', 'mfr', 'model', 'serial', 'system'];

export function diffAgainst(values: Partial<Record<Field, string>>, existing: Equipment): FieldDiff[] {
  const out: FieldDiff[] = [];
  for (const field of DIFF_FIELDS) {
    const after = values[field];
    if (!after) continue;
    const before = String(existing[field as keyof Equipment] ?? '');
    if (after !== before) out.push({ field, before, after });
  }
  return out;
}

const filled = (r: TransformedRow) => Object.values(r.values).filter(Boolean).length;

export function stageRows(rows: TransformedRow[], register: Equipment[]): StagedRow[] {
  const byTag = new Map(register.map((e) => [e.tag, e]));
  const keep = new Map<string, TransformedRow>();
  for (const r of rows) {
    if (r.blank || !r.tag) continue;
    const cur = keep.get(r.tag);
    if (!cur || filled(r) > filled(cur)) keep.set(r.tag, r);
  }
  return rows.map((r): StagedRow => {
    const base: StagedRow = {
      rowNum: r.rowNum, sourceTag: r.sourceTag, tag: r.tag, values: r.values, type: r.type, system: r.system,
      systemFromColumn: r.systemFromColumn, result: 'noChange', diff: [], notes: [...r.notes], warnings: [...r.warnings], approved: false,
    };
    if (r.blank) return { ...base, result: 'blank' };
    if (!r.tag) return { ...base, result: 'error', notes: [...base.notes, 'Missing tag'] };
    const kept = keep.get(r.tag)!;
    if (kept !== r) return { ...base, result: 'duplicate', notes: [...base.notes, `Duplicate of row ${kept.rowNum}`] };
    const existing = byTag.get(r.tag);
    if (!existing) {
      if (!r.values.desc) return { ...base, result: 'error', notes: [...base.notes, 'New tag with no description'] };
      return { ...base, result: 'new', approved: true };
    }
    const warnings = r.values.desc ? base.warnings : [...base.warnings, 'Blank description; keeping register value'];
    const diff = diffAgainst(r.values, existing);
    return diff.length ? { ...base, warnings, result: 'update', diff, approved: true } : { ...base, warnings, result: 'noChange' };
  });
}

export function countRows(rows: StagedRow[]): BatchCounts {
  const c: BatchCounts = { new: 0, update: 0, noChange: 0, duplicate: 0, error: 0, blank: 0 };
  for (const r of rows) c[r.result]++;
  return c;
}

export interface PipelineInput {
  grid: string[][]; register: Equipment[]; profiles?: MappingProfile[];
  headerRowOverride?: number; mappingOverride?: ColumnMapping;
}

export interface PipelineResult {
  headerRow: number; skippedTitleRows: number; headerConfident: boolean; headers: string[];
  mapping: ColumnMapping; confidence: Record<Field, number | null>;
  profile: { profile: MappingProfile; mode: 'applied' | 'suggested' } | null;
  rows: StagedRow[]; counts: BatchCounts;
  extracted: number; mappedColumns: number; totalColumns: number; normalizedTags: number; warnings: number;
}

export function runPipeline(input: PipelineInput): PipelineResult {
  const detected = detectHeader(input.grid);
  const headerRow = input.headerRowOverride ?? detected.headerRow;
  const headers = (input.grid[headerRow] ?? []).map((h) => h.trim());
  const auto = autoMap(headers);
  const profile = matchProfile(headers, input.profiles ?? []);
  const mapping = input.mappingOverride ?? (profile?.mode === 'applied' ? applyProfile(profile.profile, headers) : auto.mapping);
  const confidence = Object.fromEntries(FIELDS.map((f) => {
    if (mapping[f] === null) return [f, null];
    if (!input.mappingOverride && profile?.mode === 'applied') return [f, 1];
    return [f, auto.mapping[f] === mapping[f] ? auto.confidence[f] : null];
  })) as Record<Field, number | null>;
  const rows = stageRows(transformRows(input.grid, headerRow, headers, mapping), input.register);
  return {
    headerRow,
    skippedTitleRows: input.headerRowOverride ?? detected.skippedTitleRows,
    headerConfident: input.headerRowOverride !== undefined || detected.confident,
    headers, mapping, confidence, profile, rows, counts: countRows(rows),
    extracted: Math.max(0, input.grid.length - headerRow - 1),
    mappedColumns: new Set(Object.values(mapping).filter((h): h is string => h !== null)).size,
    totalColumns: headers.filter(Boolean).length,
    normalizedTags: rows.filter((r) => r.notes.some((n) => n.startsWith('Tag normalized'))).length,
    warnings: rows.reduce((n, r) => n + r.warnings.length, 0),
  };
}

export function buildBatch(r: PipelineResult, meta: { id: string; source: string; origin: ImportBatch['origin']; createdAt: string; sheetName?: string; input?: ImportBatch['input'] }): ImportBatch {
  return {
    id: meta.id, source: meta.source, origin: meta.origin, createdAt: meta.createdAt, status: 'staged',
    profileId: r.profile?.mode === 'applied' ? r.profile.profile.id : undefined,
    rows: r.rows, counts: r.counts, headers: r.headers, headerRow: r.headerRow, skippedTitleRows: r.skippedTitleRows,
    mapping: r.mapping, sheetName: meta.sheetName, input: meta.input,
  };
}
