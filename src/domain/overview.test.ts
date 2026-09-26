import { describe, it, expect } from 'vitest';
import { seedState } from '../data/seed';
import { computeStats, readinessCounts, readinessBySystem, agingBySeverity, needsAttention } from './overview';

const NOW = new Date(2026, 8, 26, 12);
const TODAY = '2026-09-26';
const s = seedState(NOW);

describe('overview selectors (hand count from seed)', () => {
  it('stat strip', () => {
    expect(computeStats(s, TODAY)).toEqual({
      equipmentCount: 27, pfcComplete: 18, fptPassed: 11, openIssues: 12, openCritical: 2, medianDaysOpen: 23,
    });
  });
  it('readiness counts', () => {
    expect(readinessCounts(s)).toEqual({ Ready: 11, Blocked: 3, Open: 13 });
  });
  it('readiness by system', () => {
    expect(readinessBySystem(s)).toEqual([
      { system: 'Air side', units: 11, pfcChecked: 59, pfcTotal: 68, pfcPct: 87, fptPassed: 3, openIssues: 7, docs: 1 },
      { system: 'Hydronic', units: 8, pfcChecked: 42, pfcTotal: 48, pfcPct: 88, fptPassed: 3, openIssues: 2, docs: 1 },
      { system: 'Electrical', units: 5, pfcChecked: 28, pfcTotal: 29, pfcPct: 97, fptPassed: 3, openIssues: 2, docs: 1 },
      { system: 'Controls', units: 2, pfcChecked: 9, pfcTotal: 10, pfcPct: 90, fptPassed: 1, openIssues: 1, docs: 0 },
      { system: 'Plumbing', units: 1, pfcChecked: 5, pfcTotal: 5, pfcPct: 100, fptPassed: 1, openIssues: 0, docs: 0 },
    ]);
  });
  it('aging by severity', () => {
    expect(agingBySeverity(s, TODAY)).toEqual([
      { bucket: '0–7', counts: { Critical: 0, Major: 0, Minor: 2 } },
      { bucket: '8–14', counts: { Critical: 2, Major: 0, Minor: 0 } },
      { bucket: '15–30', counts: { Critical: 0, Major: 1, Minor: 2 } },
      { bucket: '31+', counts: { Critical: 0, Major: 4, Minor: 1 } },
    ]);
  });
  it('needs attention', () => {
    expect(needsAttention(s, TODAY).map((x) => x.issue.id)).toEqual(['CX-003', 'CX-004', 'CX-005', 'CX-001', 'CX-002']);
  });
  it('median is null with no open issues', () => {
    expect(computeStats({ ...s, issues: [] }, TODAY).medianDaysOpen).toBeNull();
  });
});
