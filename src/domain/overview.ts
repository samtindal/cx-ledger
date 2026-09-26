import type { AppState, Issue, Severity, System } from '../types';
import { SEVERITIES, SYSTEMS } from '../types';
import { AGING_BUCKETS, agingBucket, daysOpen, pfcState, readiness, type AgingBucket, type Readiness } from './derived';

const openIssues = (s: AppState) => s.issues.filter((i) => i.closed === null);

export function computeStats(s: AppState, todayISO: string) {
  const open = openIssues(s);
  const days = open.map((i) => daysOpen(i, todayISO)).sort((a, b) => a - b);
  const mid = Math.floor(days.length / 2);
  const medianDaysOpen = days.length === 0 ? null : days.length % 2 ? days[mid] : (days[mid - 1] + days[mid]) / 2;
  return {
    equipmentCount: s.equipment.length,
    pfcComplete: s.equipment.filter((e) => pfcState(e.pfc) === 'Complete').length,
    fptPassed: s.equipment.filter((e) => e.fpt === 'Passed').length,
    openIssues: open.length,
    openCritical: open.filter((i) => i.severity === 'Critical').length,
    medianDaysOpen,
  };
}

export function readinessCounts(s: AppState): Record<Readiness, number> {
  const out: Record<Readiness, number> = { Ready: 0, Blocked: 0, Open: 0 };
  for (const e of s.equipment) out[readiness(e, s.issues)]++;
  return out;
}

export function readinessBySystem(s: AppState) {
  const open = openIssues(s);
  return SYSTEMS.map((system: System) => {
    const units = s.equipment.filter((e) => e.system === system);
    const tags = new Set(units.map((e) => e.tag));
    const pfcChecked = units.reduce((n, e) => n + e.pfc.filter(Boolean).length, 0);
    const pfcTotal = units.reduce((n, e) => n + e.pfc.length, 0);
    return {
      system, units: units.length, pfcChecked, pfcTotal,
      pfcPct: pfcTotal ? Math.round((100 * pfcChecked) / pfcTotal) : 0,
      fptPassed: units.filter((e) => e.fpt === 'Passed').length,
      openIssues: open.filter((i) => tags.has(i.tag)).length,
      docs: s.documents.filter((d) => d.tag !== null && tags.has(d.tag)).length,
    };
  }).filter((r) => r.units > 0);
}

export function agingBySeverity(s: AppState, todayISO: string) {
  return AGING_BUCKETS.map((bucket: AgingBucket) => {
    const counts = Object.fromEntries(SEVERITIES.map((sev) => [sev, 0])) as Record<Severity, number>;
    for (const i of openIssues(s)) if (agingBucket(daysOpen(i, todayISO)) === bucket) counts[i.severity]++;
    return { bucket, counts };
  });
}

export function needsAttention(s: AppState, todayISO: string, n = 5): { issue: Issue; days: number }[] {
  return openIssues(s)
    .map((issue) => ({ issue, days: daysOpen(issue, todayISO) }))
    .sort((a, b) =>
      SEVERITIES.indexOf(a.issue.severity) - SEVERITIES.indexOf(b.issue.severity) ||
      b.days - a.days ||
      a.issue.id.localeCompare(b.issue.id))
    .slice(0, n);
}
