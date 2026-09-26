import type { AppState, Equipment, FptStatus, System } from '../types';
import { pfcState, readiness, type PfcState, type Readiness } from './derived';
import { toCsv } from '../lib/csv';
import type { Tone } from '../components/Chip';

export type StateFilter = 'all' | 'pfcIncomplete' | 'fptFailed' | 'hasOpenIssues' | 'missingTab' | 'ready';

export interface RegisterFilter {
  q: string;
  system: System | 'all';
  type: string | 'all';
  state: StateFilter;
  tags?: string[];
}

export interface RegisterRow {
  eq: Equipment;
  pfcDone: number;
  pfcTotal: number;
  pfc: PfcState;
  openIssues: number;
  docs: number;
  readiness: Readiness;
}

const TAB_REPORT_SYSTEMS: System[] = ['Air side', 'Hydronic'];

function matchesQuery(eq: Equipment, q: string): boolean {
  if (!q) return true;
  const needle = q.toLowerCase();
  return [eq.tag, eq.desc, eq.location, eq.mfr, eq.model].some((v) => v.toLowerCase().includes(needle));
}

function hasTabReport(s: AppState, tag: string): boolean {
  return s.documents.some((d) => d.tag === tag && d.kind === 'TAB report');
}

function matchesState(s: AppState, eq: Equipment, state: StateFilter): boolean {
  switch (state) {
    case 'all': return true;
    case 'pfcIncomplete': return pfcState(eq.pfc) !== 'Complete';
    case 'fptFailed': return eq.fpt === 'Failed';
    case 'hasOpenIssues': return s.issues.some((i) => i.tag === eq.tag && i.closed === null);
    case 'missingTab': return TAB_REPORT_SYSTEMS.includes(eq.system) && !hasTabReport(s, eq.tag);
    case 'ready': return readiness(eq, s.issues) === 'Ready';
  }
}

export function registerRows(s: AppState, f: RegisterFilter): RegisterRow[] {
  return s.equipment
    .filter((eq) => f.system === 'all' || eq.system === f.system)
    .filter((eq) => f.type === 'all' || eq.type === f.type)
    .filter((eq) => matchesQuery(eq, f.q))
    .filter((eq) => matchesState(s, eq, f.state))
    .filter((eq) => !f.tags || f.tags.includes(eq.tag))
    .map((eq) => ({
      eq,
      pfcDone: eq.pfc.filter(Boolean).length,
      pfcTotal: eq.pfc.length,
      pfc: pfcState(eq.pfc),
      openIssues: s.issues.filter((i) => i.tag === eq.tag && i.closed === null).length,
      docs: s.documents.filter((d) => d.tag === eq.tag).length,
      readiness: readiness(eq, s.issues),
    }));
}

export function registerCsv(rows: RegisterRow[]): string {
  const header = ['Tag', 'Description', 'Type', 'System', 'Location', 'Mfr', 'Model', 'Serial', 'PFC', 'FPT', 'Open issues', 'Docs', 'Readiness'];
  const body = rows.map((r) => [
    r.eq.tag, r.eq.desc, r.eq.type, r.eq.system, r.eq.location, r.eq.mfr, r.eq.model, r.eq.serial,
    `${r.pfcDone}/${r.pfcTotal}`, r.eq.fpt, String(r.openIssues), String(r.docs), r.readiness,
  ]);
  return toCsv([header, ...body]);
}

const FPT_TONE: Record<FptStatus, Tone> = {
  Passed: 'ok', Failed: 'bad', Retest: 'warn', Scheduled: 'accent', 'Not started': 'idle',
};
const READINESS_TONE: Record<Readiness, Tone> = { Ready: 'ok', Blocked: 'bad', Open: 'idle' };
const PFC_TONE: Record<PfcState, Tone> = { Complete: 'ok', 'In progress': 'warn', 'Not started': 'idle' };

export function fptTone(f: FptStatus): Tone { return FPT_TONE[f]; }
export function readinessTone(r: Readiness): Tone { return READINESS_TONE[r]; }
export function pfcTone(p: PfcState): Tone { return PFC_TONE[p]; }
