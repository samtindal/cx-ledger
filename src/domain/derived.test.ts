import { describe, it, expect } from 'vitest';
import { pfcState, readiness, daysOpen, agingBucket } from './derived';
import type { Equipment, Issue } from '../types';

const eq = (over: Partial<Equipment> = {}): Equipment => ({
  tag: 'AHU-1', type: 'AHU', desc: '', system: 'Air side', location: '', mfr: '', model: '', serial: '',
  pfc: [true, true], fpt: 'Passed', ...over,
});
const issue = (over: Partial<Issue> = {}): Issue => ({
  id: 'CX-001', tag: 'AHU-1', desc: '', severity: 'Minor', trade: 'Mechanical', opened: '2026-09-01', closed: null, ...over,
});

describe('derived states', () => {
  it('pfcState', () => {
    expect(pfcState([true, true])).toBe('Complete');
    expect(pfcState([true, false])).toBe('In progress');
    expect(pfcState([false, false])).toBe('Not started');
  });
  it('readiness', () => {
    expect(readiness(eq(), [])).toBe('Ready');
    expect(readiness(eq(), [issue({ closed: '2026-09-02' })])).toBe('Ready');
    expect(readiness(eq(), [issue()])).toBe('Open');
    expect(readiness(eq({ fpt: 'Failed' }), [])).toBe('Blocked');
    expect(readiness(eq({ fpt: 'Scheduled' }), [issue({ severity: 'Critical' })])).toBe('Blocked');
    expect(readiness(eq({ pfc: [true, false] }), [])).toBe('Open');
    expect(readiness(eq(), [issue({ tag: 'AHU-2', severity: 'Critical' })])).toBe('Ready');
  });
  it('daysOpen', () => {
    expect(daysOpen(issue(), '2026-09-26')).toBe(25);
    expect(daysOpen(issue({ closed: '2026-09-11' }), '2026-09-26')).toBe(10);
  });
  it('agingBucket boundaries', () => {
    expect([0, 7, 8, 14, 15, 30, 31, 90].map(agingBucket)).toEqual(['0–7', '0–7', '8–14', '8–14', '15–30', '15–30', '31+', '31+']);
  });
});
