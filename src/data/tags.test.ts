import { describe, it, expect } from 'vitest';
import { normalizeTag, typeOf, systemFor, isKnownType } from './tags';

describe('normalizeTag', () => {
  it.each([
    ['ahu 3', 'AHU-3'], ['P 5', 'P-5'], ['VAV2-15', 'VAV-2-15'], ['gen1', 'GEN-1'],
    ['XFMR-T1', 'XFMR-T1'], ['  ef-4 ', 'EF-4'], ['AHU__2', 'AHU-2'], ['_ahu3', 'AHU-3'],
    ['VFD-AHU2', 'VFD-AHU2'], ['ats1', 'ATS-1'], ['VAV-1--01', 'VAV-1-01'], ['', ''],
  ])('%s -> %s', (raw, want) => expect(normalizeTag(raw)).toBe(want));
});

describe('registry', () => {
  it('derives type from the leading letters', () => {
    expect(typeOf('VAV-2-15')).toBe('VAV');
    expect(typeOf('XFMR-T1')).toBe('XFMR');
    expect(typeOf('ZZ-9')).toBe('ZZ');
  });
  it('maps types to systems', () => {
    expect(systemFor('AHU')).toBe('Air side');
    expect(systemFor('P')).toBe('Hydronic');
    expect(systemFor('XFMR')).toBe('Electrical');
    expect(systemFor('LC')).toBe('Controls');
    expect(systemFor('DWH')).toBe('Plumbing');
    expect(systemFor('ZZ')).toBe('Unassigned');
    expect(isKnownType('ZZ')).toBe(false);
  });
});
