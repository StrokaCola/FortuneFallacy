import { describe, it, expect } from 'vitest';
import { TIPS, getTipOfTheDay } from './tips';

describe('getTipOfTheDay', () => {
  it('returns a tip from the pool', () => {
    const tip = getTipOfTheDay(new Date(Date.UTC(2026, 4, 13)));
    expect(TIPS).toContain(tip);
  });

  it('is deterministic per UTC day', () => {
    const a = getTipOfTheDay(new Date(Date.UTC(2026, 4, 13, 0, 0, 0)));
    const b = getTipOfTheDay(new Date(Date.UTC(2026, 4, 13, 23, 59, 59)));
    expect(a).toBe(b);
  });

  it('changes day-over-day', () => {
    // Collect a week of tips. Most days should differ — the pool is large
    // enough that a sequence of 7 has high probability of returning at
    // least 5 distinct strings.
    const tips = new Set<string>();
    for (let d = 1; d <= 7; d++) {
      tips.add(getTipOfTheDay(new Date(Date.UTC(2026, 4, d))));
    }
    expect(tips.size).toBeGreaterThanOrEqual(5);
  });

  it('covers the whole pool across enough days', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 365; i++) {
      const d = new Date(Date.UTC(2026, 0, 1));
      d.setUTCDate(d.getUTCDate() + i);
      seen.add(getTipOfTheDay(d));
    }
    // A year of dates should hit at least 80% of the tip pool given
    // FNV-1a's spread on sequential date strings.
    expect(seen.size).toBeGreaterThanOrEqual(Math.floor(TIPS.length * 0.8));
  });
});
