import { describe, it, expect } from 'vitest';
import {
  getDailyDate,
  getDailySeed,
  getDailyConstellation,
  getDailyStake,
  getDailyChallenge,
} from './dailyChallenge';
import { CONSTELLATIONS } from '../data/constellations';
import { STAKES } from '../data/stakes';

describe('dailyChallenge', () => {
  describe('getDailyDate', () => {
    it('formats UTC as YYYY-MM-DD', () => {
      const date = new Date(Date.UTC(2026, 4, 8, 12, 0, 0));
      expect(getDailyDate(date)).toBe('2026-05-08');
    });

    it('zero-pads month and day', () => {
      const date = new Date(Date.UTC(2026, 0, 1, 0, 0, 0));
      expect(getDailyDate(date)).toBe('2026-01-01');
    });

    it('uses UTC, not local time, for the date string', () => {
      // 2026-05-08 23:30 UTC is 2026-05-09 in the early morning of UTC+1
      // timezones, but the daily date is always UTC so the global
      // leaderboard partitions cleanly. Verifying against UTC explicitly
      // since `new Date` defaults parse local-time in some environments.
      const date = new Date(Date.UTC(2026, 4, 8, 23, 30, 0));
      expect(getDailyDate(date)).toBe('2026-05-08');
    });
  });

  describe('getDailySeed', () => {
    it('is deterministic for the same date string', () => {
      expect(getDailySeed('2026-05-08')).toBe(getDailySeed('2026-05-08'));
    });

    it('produces different seeds for adjacent dates', () => {
      const a = getDailySeed('2026-05-08');
      const b = getDailySeed('2026-05-09');
      expect(a).not.toBe(b);
    });

    it('returns a 32-bit unsigned integer', () => {
      const seed = getDailySeed('2026-05-08');
      expect(seed).toBeGreaterThanOrEqual(0);
      expect(seed).toBeLessThanOrEqual(0xFFFFFFFF);
      expect(Number.isInteger(seed)).toBe(true);
    });
  });

  describe('getDailyConstellation', () => {
    it('always returns an existing constellation id', () => {
      const ids = new Set(CONSTELLATIONS.map((c) => c.id));
      for (let day = 1; day <= 30; day++) {
        const date = `2026-05-${String(day).padStart(2, '0')}`;
        expect(ids.has(getDailyConstellation(date))).toBe(true);
      }
    });

    it('rotates across multiple constellations within a month', () => {
      const seen = new Set<string>();
      for (let day = 1; day <= 30; day++) {
        const date = `2026-05-${String(day).padStart(2, '0')}`;
        seen.add(getDailyConstellation(date));
      }
      // Loosely: at least 3 distinct constellations show up in 30 days.
      // Stronger guarantees would over-constrain the rotation function.
      expect(seen.size).toBeGreaterThanOrEqual(3);
    });
  });

  describe('getDailyStake', () => {
    it('always returns an existing stake id', () => {
      const ids = new Set(STAKES.map((s) => s.id));
      for (let day = 1; day <= 30; day++) {
        const date = `2026-05-${String(day).padStart(2, '0')}`;
        expect(ids.has(getDailyStake(date))).toBe(true);
      }
    });

    it('skews toward easier stakes (Spark/Ember/Pyre dominate)', () => {
      const counts: Record<string, number> = {};
      for (let day = 1; day <= 100; day++) {
        const date = `2026-05-${String(day).padStart(2, '0')}`;
        const stake = getDailyStake(date);
        counts[stake] = (counts[stake] ?? 0) + 1;
      }
      // Spark should be the modal stake by design — keeps daily approachable.
      const easyShare = (counts['spark'] ?? 0) + (counts['ember'] ?? 0) + (counts['pyre'] ?? 0);
      expect(easyShare).toBeGreaterThanOrEqual(70);
    });
  });

  describe('getDailyChallenge', () => {
    it('bundles date, seed, constellation, stake, and mode', () => {
      const dt = new Date(Date.UTC(2026, 4, 8));
      const ch = getDailyChallenge(dt);
      expect(ch.date).toBe('2026-05-08');
      expect(ch.seed).toBe(getDailySeed('2026-05-08'));
      expect(ch.constellationId).toBe(getDailyConstellation('2026-05-08'));
      expect(ch.stakeId).toBe(getDailyStake('2026-05-08'));
      expect(ch.mode).toBe('daily-2026-05-08');
    });

    it('is fully deterministic for the same Date', () => {
      const dt = new Date(Date.UTC(2026, 4, 8));
      expect(getDailyChallenge(dt)).toEqual(getDailyChallenge(dt));
    });
  });
});
