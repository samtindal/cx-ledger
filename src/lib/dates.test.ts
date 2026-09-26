import { describe, it, expect, afterEach, vi } from 'vitest';
import { today, daysAgo, daysBetween, toLocalISO } from './dates';

describe('local dates', () => {
  afterEach(() => vi.useRealTimers());
  it('uses local time late at night (no UTC shift)', () => {
    const now = new Date(2026, 8, 26, 23, 30);
    expect(today(now)).toBe('2026-09-26');
    expect(daysAgo(1, now)).toBe('2026-09-25');
  });
  it('uses local time just after midnight', () => {
    const now = new Date(2026, 8, 26, 0, 30);
    expect(today(now)).toBe('2026-09-26');
    expect(daysAgo(0, now)).toBe('2026-09-26');
  });
  it('defaults to the system clock', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 0, 3, 12));
    expect(today()).toBe('2026-01-03');
    expect(daysAgo(3)).toBe('2025-12-31');
  });
  it('counts whole days across DST changes', () => {
    expect(daysBetween('2026-11-01', '2026-11-02')).toBe(1);
    expect(daysBetween('2026-03-07', '2026-03-09')).toBe(2);
    expect(daysBetween('2026-09-26', '2026-09-26')).toBe(0);
  });
  it('pads months and days', () => {
    expect(toLocalISO(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
});
