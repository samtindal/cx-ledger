import { describe, it, expect } from 'vitest';
import { matchFilename, detectKind } from './matchFilename';
import { buildSeed } from '../data/seed';

const tags = buildSeed().equipment.map((e) => e.tag);

describe('matchFilename (spec table)', () => {
  it.each([
    ['AHU-2_TAB_Report.pdf', { tags: ['AHU-2'], kind: 'TAB report', status: 'linked' }],
    ['ahu 2 submittal rev1.pdf', { tags: ['AHU-2'], kind: 'Submittal', status: 'linked' }],
    ['P-3 FPT 2026-09-14.pdf', { tags: ['P-3'], kind: 'FPT form', status: 'linked' }],
    ['ATS1_OM_Manual.pdf', { tags: ['ATS-1'], kind: 'O&M manual', status: 'linked' }],
    ['AHU-1 and AHU-2 filters.pdf', { tags: ['AHU-1', 'AHU-2'], kind: 'Other', status: 'ambiguous' }],
    ['Mech_Schedules_M-601.pdf', { tags: [], kind: 'Drawing', status: 'unassigned' }],
  ])('%s', (name, want) => expect(matchFilename(name, tags)).toEqual(want));
  it('does not treat room/substation as O&M or Submittal', () => {
    expect(detectKind('Boiler Room photo.jpg')).toBe('Other');
    expect(detectKind('substation layout.pdf')).toBe('Other');
    expect(detectKind('Balancing report.pdf')).toBe('TAB report');
  });
});
