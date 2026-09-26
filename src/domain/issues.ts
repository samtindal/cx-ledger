import type { Issue } from '../types';

export function nextIssueId(issues: Issue[]): string {
  const max = issues.reduce((m, i) => Math.max(m, Number(/^CX-(\d+)$/.exec(i.id)?.[1] ?? 0)), 0);
  return `CX-${String(max + 1).padStart(3, '0')}`;
}
