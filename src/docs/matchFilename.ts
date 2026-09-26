import type { DocKind } from '../types';
import { normalizeTag } from '../data/tags';

const B = '(?<![a-z0-9])';
const KIND_RULES: [DocKind, RegExp][] = [
  ['Submittal', new RegExp(`${B}(submittal|sub(?![a-z]))`)],
  ['TAB report', new RegExp(`${B}(tab(?![a-z])|balanc)`)],
  ['FPT form', new RegExp(`${B}(fpt|functional|test)`)],
  ['O&M manual', new RegExp(`${B}(o&m|om(?![a-z])|manual)`)],
  ['Drawing', new RegExp(`${B}(dwg|drawing|schedule|m-\\d)`)],
];

const stem = (name: string) => name.replace(/\.[^.]+$/, '');

export function detectKind(filename: string): DocKind {
  const s = stem(filename).toLowerCase().replace(/_/g, ' ');
  return KIND_RULES.find(([, re]) => re.test(s))?.[0] ?? 'Other';
}

export type MatchStatus = 'linked' | 'ambiguous' | 'unassigned';

export function matchFilename(name: string, registerTags: Iterable<string>): { tags: string[]; kind: DocKind; status: MatchStatus } {
  const known = new Set(registerTags);
  const tokens = stem(name).split(/[^A-Za-z0-9-]+/).filter(Boolean);
  const candidates = [...tokens, ...tokens.slice(1).map((t, i) => `${tokens[i]} ${t}`)].map(normalizeTag);
  const tags = [...new Set(candidates.filter((c) => known.has(c)))];
  const status: MatchStatus = tags.length === 1 ? 'linked' : tags.length > 1 ? 'ambiguous' : 'unassigned';
  return { tags, kind: detectKind(name), status };
}
