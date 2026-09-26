import { describe, it, expect } from 'vitest';
import { buildSeed } from './seed';

const NOW = new Date(2026, 8, 26, 12);
const count = (pfc: boolean[]) => `${pfc.filter(Boolean).length}/${pfc.length}`;

describe('seed', () => {
  const { equipment, issues } = buildSeed(NOW);
  const byTag = Object.fromEntries(equipment.map((e) => [e.tag, e]));
  it('has 27 units and 16 issues', () => {
    expect(equipment).toHaveLength(27);
    expect(issues).toHaveLength(16);
  });
  it('seeds PFC per the system-length rule', () => {
    expect(count(byTag['AHU-1'].pfc)).toBe('7/7');
    expect(count(byTag['EF-1'].pfc)).toBe('5/6');
    expect(count(byTag['EF-2'].pfc)).toBe('6/6');
    expect(count(byTag['EF-3'].pfc)).toBe('4/6');
    expect(count(byTag['VAV-1-01'].pfc)).toBe('4/5');
    expect(count(byTag['VAV-2-01'].pfc)).toBe('5/5');
    expect(count(byTag['FCU-1'].pfc)).toBe('3/7');
    expect(count(byTag['P-1'].pfc)).toBe('5/5');
    expect(count(byTag['P-2'].pfc)).toBe('4/5');
    expect(count(byTag['HX-1'].pfc)).toBe('2/7');
    expect(count(byTag['ATS-1'].pfc)).toBe('5/5');
    expect(count(byTag['GEN-1'].pfc)).toBe('5/6');
    expect(count(byTag['BAS-1'].pfc)).toBe('4/5');
    expect(byTag['EF-1'].pfc.slice(0, 5).every(Boolean)).toBe(true);
  });
  it('builds dates relative to today', () => {
    const cx10 = issues.find((i) => i.id === 'CX-010')!;
    expect(cx10.opened).toBe('2026-07-16');
    expect(cx10.closed).toBe('2026-08-07');
    expect(issues.find((i) => i.id === 'CX-001')!.closed).toBeNull();
  });
  it('derives type and keeps VFD-AHU2 intact', () => {
    expect(byTag['VFD-AHU2'].type).toBe('VFD');
    expect(byTag['VAV-2-01'].type).toBe('VAV');
  });
});
