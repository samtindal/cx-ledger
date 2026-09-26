import { describe, it, expect } from 'vitest';
import { normalizeHeader, fieldScore, autoMap, levenshtein } from '../fuzzy';

describe('fuzzy matching', () => {
  it('normalizes headers', () => {
    expect(normalizeHeader('Model #')).toBe('model');
    expect(normalizeHeader('Loc.')).toBe('loc');
  });
  it('levenshtein', () => {
    expect(levenshtein('manufactuer', 'manufacturer')).toBe(1);
    expect(levenshtein('', 'abc')).toBe(3);
  });
  it('matches spec examples', () => {
    expect(fieldScore('Equipment Desc.', 'desc')).toBe(0.8);
    expect(fieldScore('Manufactuer', 'mfr')).toBeCloseTo(1 - 1 / 12, 5);
    expect(fieldScore('Equip Tag', 'tag')).toBe(1);
    expect(fieldScore('Serial #', 'serial')).toBe(1);
    expect(fieldScore('SN', 'serial')).toBe(1);
    expect(fieldScore('Notes', 'tag')).toBe(0);
  });
  it('maps the golden headers 6/6 with full confidence', () => {
    const { mapping, confidence } = autoMap(['Equip Tag', 'EQUIPMENT DESCRIPTION', 'Loc.', 'Mfr', 'Model #', 'Serial #']);
    expect(mapping).toEqual({ tag: 'Equip Tag', desc: 'EQUIPMENT DESCRIPTION', location: 'Loc.', mfr: 'Mfr', model: 'Model #', serial: 'Serial #', system: null });
    expect(confidence).toEqual({ tag: 1, desc: 1, location: 1, mfr: 1, model: 1, serial: 1, system: null });
  });
  it('assigns one header per field, greedily', () => {
    const { mapping, confidence } = autoMap(['Unit Tag', 'Equipment Desc.', 'Manufactuer', 'Description']);
    expect(mapping.desc).toBe('Description');
    expect(mapping.mfr).toBe('Manufactuer');
    expect(mapping.tag).toBe('Unit Tag');
    expect(confidence.mfr!).toBeLessThan(1);
  });
});
