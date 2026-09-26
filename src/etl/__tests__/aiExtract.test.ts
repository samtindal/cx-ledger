import { describe, it, expect } from 'vitest';
import { stageExtraction, isExtractionResponse } from '../aiExtract';
import { buildSeed } from '../../data/seed';
import { loadFixtureText } from './fixtures';

const resp = JSON.parse(loadFixtureText('ahu-schedule.extract.json'));
const register = buildSeed(new Date(2026, 8, 26, 12)).equipment;

describe('AI extraction golden', () => {
  it('validates the response shape', () => {
    expect(isExtractionResponse(resp)).toBe(true);
    expect(isExtractionResponse({ rows: [{ tag: 1 }] })).toBe(false);
  });
  const r = stageExtraction(resp, register);
  it('runs through the same pipeline', () => {
    expect(r.counts).toEqual({ new: 3, update: 1, noChange: 1, duplicate: 0, error: 0, blank: 0 });
    expect(r.rows.map((x) => [x.tag, x.result])).toEqual([
      ['AHU-4', 'new'], ['AHU-5', 'new'], ['AHU-1', 'noChange'], ['AHU-2', 'update'], ['AHU-6', 'new'],
    ]);
  });
  it('stages low-confidence rows unapproved and carries AI meta', () => {
    expect(r.rows.map((x) => x.approved)).toEqual([true, true, false, false, false]);
    expect(r.rows[3].ai).toEqual({ sourcePage: 2, confidence: 'low' });
    expect(r.rows[3].diff).toEqual([{ field: 'serial', before: '', after: 'K22H4415' }]);
    expect(r.rows[4].notes).toContain('Tag normalized: "ahu6" → "AHU-6"');
  });
});
