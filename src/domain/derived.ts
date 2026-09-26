import type { Equipment, Issue } from '../types';
import { daysBetween } from '../lib/dates';

export type PfcState = 'Complete' | 'In progress' | 'Not started';
export type Readiness = 'Ready' | 'Blocked' | 'Open';
export type AgingBucket = '0–7' | '8–14' | '15–30' | '31+';
export const AGING_BUCKETS: AgingBucket[] = ['0–7', '8–14', '15–30', '31+'];

export function pfcState(pfc: boolean[]): PfcState {
  const done = pfc.filter(Boolean).length;
  if (pfc.length > 0 && done === pfc.length) return 'Complete';
  return done > 0 ? 'In progress' : 'Not started';
}

export function readiness(eq: Equipment, issues: Issue[]): Readiness {
  const open = issues.filter((i) => i.tag === eq.tag && i.closed === null);
  if (eq.fpt === 'Failed' || open.some((i) => i.severity === 'Critical')) return 'Blocked';
  if (pfcState(eq.pfc) === 'Complete' && eq.fpt === 'Passed' && open.length === 0) return 'Ready';
  return 'Open';
}

export function daysOpen(issue: Issue, todayISO: string): number {
  return daysBetween(issue.opened, issue.closed ?? todayISO);
}

export function agingBucket(days: number): AgingBucket {
  if (days <= 7) return '0–7';
  if (days <= 14) return '8–14';
  if (days <= 30) return '15–30';
  return '31+';
}
