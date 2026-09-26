import { describe, it, expect } from 'vitest';
import { planIntake, attachDocument, assignDocument, nextDocId } from './intake';
import { seedState } from '../data/seed';

describe('intake', () => {
  const s0 = seedState(new Date(2026, 8, 26, 12));
  it('plans per file before saving, rejecting > 25 MB', () => {
    const plan = planIntake([
      { name: 'AHU-1 and AHU-2 filters.pdf', size: 1000, type: 'application/pdf' },
      { name: 'huge.pdf', size: 26 * 1024 * 1024, type: 'application/pdf' },
    ], s0.equipment.map((e) => e.tag));
    expect(plan.map((p) => p.status)).toEqual(['ambiguous', 'too-large']);
    expect(plan[0].tags).toEqual(['AHU-1', 'AHU-2']);
  });
  it('seeds three linked documents', () => {
    expect(s0.documents.map((d) => [d.tag, d.kind])).toEqual([['AHU-2', 'TAB report'], ['P-3', 'FPT form'], ['ATS-1', 'Submittal']]);
    expect(nextDocId(s0.documents)).toBe('DOC-0004');
  });
  it('attaches and assigns through applyChange', () => {
    let s = attachDocument(s0, { id: 'DOC-0004', filename: 'x.pdf', kind: 'Other', mime: 'application/pdf', size: 10, tag: null, matchedBy: 'filename', candidates: ['AHU-1', 'AHU-2'], blobKey: 'DOC-0004' });
    expect(s.changes.at(-1)).toMatchObject({ entity: 'document', op: 'create', key: 'DOC-0004' });
    s = assignDocument(s, 'DOC-0004', 'AHU-1');
    expect(s.documents.at(-1)).toMatchObject({ tag: 'AHU-1', matchedBy: 'manual' });
    expect(s.documents.at(-1)!.candidates).toBeUndefined();
    expect(s.changes.at(-1)).toMatchObject({ entity: 'document', key: 'DOC-0004' });
  });
});
