import { describe, it, expect } from 'vitest';
import { headerSignature, matchProfile, applyProfile, createProfile, addProfile, renameProfile, deleteProfile } from '../profiles';
import { autoMap } from '../fuzzy';
import { seedState } from '../../data/seed';

const HEADERS = ['Equip Tag', 'EQUIPMENT DESCRIPTION', 'Loc.', 'Mfr', 'Model #', 'Serial #'];

describe('profiles', () => {
  const profile = createProfile({ name: 'Acme Mechanical equipment schedule', headers: HEADERS, mapping: autoMap(HEADERS).mapping, headerRow: 0, now: '2026-09-26T12:00:00Z', existing: [] });
  it('builds a sorted signature', () => {
    expect(headerSignature(HEADERS)).toBe('equipmentdescription|equiptag|loc|mfr|model|serial');
    expect(profile.id).toBe('PRF-0001');
  });
  it('applies on exact signature match regardless of column order', () => {
    const reordered = ['Serial #', 'Loc.', 'Equip Tag', 'Model #', 'Mfr', 'EQUIPMENT DESCRIPTION'];
    expect(matchProfile(reordered, [profile])).toEqual({ profile, mode: 'applied' });
    expect(applyProfile(profile, reordered)).toEqual(autoMap(HEADERS).mapping);
  });
  it('suggests on >= 80% overlap and ignores lower', () => {
    expect(matchProfile([...HEADERS.slice(0, 5), 'Voltage'], [profile])?.mode).toBe('suggested'); // 5/6
    expect(matchProfile(HEADERS.slice(0, 4), [profile])).toBeNull(); // 4/6
  });
  it('maps missing headers to null', () => {
    expect(applyProfile(profile, HEADERS.slice(0, 5)).serial).toBeNull();
  });
  it('CRUD on state', () => {
    let s = addProfile(seedState(), profile);
    s = renameProfile(s, 'PRF-0001', 'Acme v2');
    expect(s.profiles[0].name).toBe('Acme v2');
    expect(deleteProfile(s, 'PRF-0001').profiles).toEqual([]);
  });
});
