import { describe, it, expect } from 'vitest';
import { checklistFor } from './checklists';

describe('checklistFor', () => {
  it('prefers a type template', () => {
    expect(checklistFor('VAV', 'Air side')).toHaveLength(5);
    expect(checklistFor('EF', 'Air side')).toHaveLength(6);
    expect(checklistFor('SF', 'Air side')).toEqual(checklistFor('EF', 'Air side'));
    expect(checklistFor('ATS', 'Electrical')).toHaveLength(5);
    expect(checklistFor('GEN', 'Electrical')).toHaveLength(6);
    expect(checklistFor('P', 'Hydronic')).toHaveLength(5);
  });
  it('falls back to the system template', () => {
    expect(checklistFor('AHU', 'Air side')).toHaveLength(7);
    expect(checklistFor('CH', 'Hydronic')).toHaveLength(7);
    expect(checklistFor('SWBD', 'Electrical')).toHaveLength(6);
    expect(checklistFor('BAS', 'Controls')).toHaveLength(5);
    expect(checklistFor('DWH', 'Plumbing')).toHaveLength(5);
    expect(checklistFor('ZZ', 'Unassigned')).toHaveLength(3);
    expect(checklistFor('AHU', 'Air side')[4]).toBe('Fan rotation verified');
  });
});
