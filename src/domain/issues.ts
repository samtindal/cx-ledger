import type { Issue, Severity, Trade } from '../types';
import type { Tone } from '../components/Chip';
import { daysOpen } from './derived';

export function nextIssueId(issues: Issue[]): string {
  const max = issues.reduce((m, i) => Math.max(m, Number(/^CX-(\d+)$/.exec(i.id)?.[1] ?? 0)), 0);
  return `CX-${String(max + 1).padStart(3, '0')}`;
}

export type IssueSegment = 'Open' | 'Closed' | 'All';
export interface IssueFilter { segment: IssueSegment; severity: Severity | 'all'; trade: Trade | 'all'; q: string }

export function filterIssues(issues: Issue[], f: IssueFilter): Issue[] {
  const q = f.q.trim().toLowerCase();
  return issues
    .filter((i) => f.segment === 'All' || (f.segment === 'Open' ? i.closed === null : i.closed !== null))
    .filter((i) => f.severity === 'all' || i.severity === f.severity)
    .filter((i) => f.trade === 'all' || i.trade === f.trade)
    .filter((i) => !q || `${i.id} ${i.tag} ${i.desc}`.toLowerCase().includes(q))
    .sort((a, b) => a.id.localeCompare(b.id));
}

export function emptyMessage(f: IssueFilter): string {
  const seg = f.segment === 'All' ? '' : `${f.segment.toLowerCase()} `;
  const sev = f.severity === 'all' ? '' : `${f.severity} `;
  const trade = f.trade === 'all' ? '' : ` for ${f.trade}`;
  const q = f.q.trim() ? ` matching "${f.q.trim()}"` : '';
  return `No ${seg}${sev}issues${trade}${q}.`;
}

export function daysLabel(issue: Issue, todayISO: string): string {
  const n = daysOpen(issue, todayISO);
  return issue.closed === null ? String(n) : `closed in ${n} ${n === 1 ? 'day' : 'days'}`;
}

export const severityTone = (s: Severity): Tone => ({ Critical: 'bad', Major: 'warn', Minor: 'idle' } as const)[s];
