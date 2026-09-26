import { describe, it, expect } from 'vitest';
import { filterIssues, emptyMessage, daysLabel, type IssueFilter } from './issues';
import { seedState } from '../data/seed';

const s = seedState(new Date(2026, 8, 26, 12));
const f = (over: Partial<IssueFilter> = {}): IssueFilter => ({ segment: 'Open', severity: 'all', trade: 'all', q: '', ...over });

describe('issues', () => {
  it('segments', () => {
    expect(filterIssues(s.issues, f())).toHaveLength(12);
    expect(filterIssues(s.issues, f({ segment: 'Closed' })).map((i) => i.id)).toEqual(['CX-010', 'CX-011', 'CX-012', 'CX-013']);
    expect(filterIssues(s.issues, f({ segment: 'All' }))).toHaveLength(16);
  });
  it('filters by severity, trade, and search', () => {
    expect(filterIssues(s.issues, f({ severity: 'Critical' })).map((i) => i.id)).toEqual(['CX-003', 'CX-004']);
    expect(filterIssues(s.issues, f({ trade: 'TAB' })).map((i) => i.id)).toEqual(['CX-014', 'CX-016']);
    expect(filterIssues(s.issues, f({ q: 'ahu-2' })).map((i) => i.id)).toEqual(['CX-001', 'CX-002', 'CX-016']);
    expect(filterIssues(s.issues, f({ severity: 'Critical', trade: 'Mechanical' }))).toEqual([]);
  });
  it('explains empty results', () => {
    expect(emptyMessage(f({ severity: 'Critical', trade: 'Controls' }))).toBe('No open Critical issues for Controls.');
    expect(emptyMessage(f({ segment: 'All' }))).toBe('No issues.');
    expect(emptyMessage(f({ segment: 'Closed', q: 'pump' }))).toBe('No closed issues matching "pump".');
  });
  it('labels days', () => {
    const cx3 = s.issues.find((i) => i.id === 'CX-003')!;
    const cx13 = s.issues.find((i) => i.id === 'CX-013')!;
    expect(daysLabel(cx3, '2026-09-26')).toBe('12');
    expect(daysLabel(cx13, '2026-09-26')).toBe('closed in 18 days');
  });
});
