export type System = 'Air side' | 'Hydronic' | 'Electrical' | 'Controls' | 'Plumbing' | 'Unassigned';
export const SYSTEMS: System[] = ['Air side', 'Hydronic', 'Electrical', 'Controls', 'Plumbing', 'Unassigned'];

export type FptStatus = 'Not started' | 'Scheduled' | 'Passed' | 'Failed' | 'Retest';
export const FPT_STATUSES: FptStatus[] = ['Not started', 'Scheduled', 'Passed', 'Failed', 'Retest'];

export type Severity = 'Critical' | 'Major' | 'Minor';
export const SEVERITIES: Severity[] = ['Critical', 'Major', 'Minor'];

export type Trade = 'Mechanical' | 'Electrical' | 'Controls' | 'TAB' | 'Design team';
export const TRADES: Trade[] = ['Mechanical', 'Electrical', 'Controls', 'TAB', 'Design team'];

export type DocKind = 'Submittal' | 'TAB report' | 'FPT form' | 'O&M manual' | 'Drawing' | 'Other';
export const DOC_KINDS: DocKind[] = ['Submittal', 'TAB report', 'FPT form', 'O&M manual', 'Drawing', 'Other'];

export type Field = 'tag' | 'desc' | 'location' | 'mfr' | 'model' | 'serial' | 'system';
export const FIELDS: Field[] = ['tag', 'desc', 'location', 'mfr', 'model', 'serial', 'system'];

export interface Equipment {
  tag: string;            // primary key, normalized (e.g. "VAV-2-15")
  type: string;           // tag prefix, e.g. "VAV"
  desc: string;
  system: System;
  location: string;
  mfr: string;
  model: string;
  serial: string;
  pfc: boolean[];         // one per item in checklistFor(type, system)
  fpt: FptStatus;
  fptDate?: string;       // local yyyy-mm-dd
}

export interface Issue {
  id: string;             // "CX-001"
  tag: string;
  desc: string;
  severity: Severity;
  trade: Trade;
  opened: string;         // local yyyy-mm-dd
  closed: string | null;
}

export interface DocumentRef {
  id: string;             // "DOC-0001"
  tag: string | null;     // null = unassigned queue
  filename: string;
  kind: DocKind;
  mime: string;
  size: number;
  addedAt: string;        // ISO timestamp
  blobKey: string;        // IndexedDB key; "seed:<file>" for bundled samples
  matchedBy: 'filename' | 'manual';
  candidates?: string[];  // ambiguous filename matches offered as choices
}

/** target field -> source header text (as it appears in the file), or null = "Not in file" */
export type ColumnMapping = Record<Field, string | null>;

export interface MappingProfile {
  id: string;             // "PRF-0001"
  name: string;
  headerSignature: string;
  sheetName?: string;
  headerRow: number;      // 0-based
  columns: ColumnMapping;
  lastUsed: string;       // ISO timestamp
}

export type RowResult = 'new' | 'update' | 'noChange' | 'duplicate' | 'error' | 'blank';
export type BatchCounts = Record<RowResult, number>;

export interface FieldDiff { field: Field; before: string; after: string }

export interface StagedRow {
  rowNum: number;         // 1-based index among data rows (first row under the header = 1)
  sourceTag: string;      // raw cell text
  tag: string;            // normalized; '' when missing
  values: Partial<Record<Field, string>>; // cleaned, non-empty incoming values only
  type: string;
  system: System;
  systemFromColumn: boolean;
  result: RowResult;
  diff: FieldDiff[];
  notes: string[];        // transform notes, "Duplicate of row N", error reasons
  warnings: string[];
  approved: boolean;
  ai?: { sourcePage: number; confidence: 'high' | 'medium' | 'low' };
}

export interface SheetGrid { sheetName: string; rows: string[][] }

export interface LoadReport { created: string[]; updated: string[]; unchanged: string[]; skipped: number }

export interface ImportBatch {
  id: string;             // "IMP-0001"
  source: string;         // file name, or "Pasted text"
  origin: 'csv' | 'xlsx' | 'ai-extract';
  profileId?: string;
  createdAt: string;
  status: 'staged' | 'loaded' | 'rolled back';
  rows: StagedRow[];
  counts: BatchCounts;
  headers: string[];
  headerRow: number;
  skippedTitleRows: number;
  mapping: ColumnMapping;
  sheetName?: string;
  input?: { sheets: SheetGrid[]; sheetIndex: number }; // kept only while staged
  loadedAt?: string;
  loadReport?: LoadReport;
  rolledBackAt?: string;
}

export interface ChangeRecord {
  id: string;             // "CR-00001"
  batchId: string | null; // null = manual edit
  entity: 'equipment' | 'issue' | 'document';
  key: string;            // tag, issue ID, or document ID
  op: 'create' | 'update' | 'delete';
  field?: string;
  before?: unknown;
  after?: unknown;
  at: string;             // ISO timestamp
  actor: string;          // "Demo user"
}

export interface AppState {
  version: 1;
  equipment: Equipment[];
  issues: Issue[];
  documents: DocumentRef[];
  profiles: MappingProfile[];
  batches: ImportBatch[];
  changes: ChangeRecord[];
}
