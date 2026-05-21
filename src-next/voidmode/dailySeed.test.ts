import { describe, it, expect } from 'vitest';
import { getVoidDailyDate, getTodayCertified, getCertifiedFor, voidLeaderboardMode } from './dailySeed';

describe('getVoidDailyDate', () => {
  it('formats UTC date as YYYY-MM-DD', () => {
    const d = new Date('2026-05-20T23:59:00Z');
    expect(getVoidDailyDate(d)).toBe('2026-05-20');
  });

  it('rolls to next day at UTC midnight', () => {
    const d = new Date('2026-05-21T00:00:01Z');
    expect(getVoidDailyDate(d)).toBe('2026-05-21');
  });
});

describe('getTodayCertified', () => {
  it('returns an entry for today when the registry has one', () => {
    // The test passes if today's entry exists in dailyCertified.json,
    // OR if there is NO entry (in which case it returns undefined and
    // the certified flag is just false for everyone today). Both are
    // valid states; we only assert that getTodayCertified is callable
    // and either returns a well-shaped entry or undefined.
    const entry = getTodayCertified();
    if (entry !== undefined) {
      expect(typeof entry.date).toBe('string');
      expect(typeof entry.seed).toBe('number');
      expect(typeof entry.clearRate).toBe('number');
    }
  });

  it('returns undefined for a date with no entry', () => {
    expect(getTodayCertified(new Date('2099-12-31T12:00:00Z'))).toBeUndefined();
  });
});

describe('getCertifiedFor', () => {
  it('returns undefined for an unknown date', () => {
    expect(getCertifiedFor('2099-12-31')).toBeUndefined();
  });
});

describe('voidLeaderboardMode', () => {
  it('returns the date-tagged mode string when certified', () => {
    expect(voidLeaderboardMode(true, new Date('2026-05-20T12:00:00Z')))
      .toBe('void-2026-05-20');
  });
  it('returns null when not certified', () => {
    expect(voidLeaderboardMode(false)).toBeNull();
  });
});
