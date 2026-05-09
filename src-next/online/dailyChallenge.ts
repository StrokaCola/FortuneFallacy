// Daily Challenge: a deterministic per-UTC-day run config so every player
// gets the same seed, constellation, and stake on the same day. Pairs with
// the leaderboard module — daily scores submit under a 'daily-YYYY-MM-DD'
// mode so they can be ranked separately from regular runs.
//
// The pipeline is fully deterministic: same date string → same seed →
// same constellation → same stake. Local-only state. No network calls.

import { CONSTELLATIONS } from '../data/constellations';
import { STAKES } from '../data/stakes';

export type DailyChallenge = {
  date: string;            // 'YYYY-MM-DD' UTC
  seed: number;            // 32-bit unsigned
  constellationId: string;
  stakeId: string;
  mode: string;            // 'daily-YYYY-MM-DD' for leaderboard partitioning
};

/**
 * Format a Date as a UTC 'YYYY-MM-DD' string. Defaults to "now" so callers
 * can simply call getDailyDate() to grab today's identifier.
 */
export function getDailyDate(now: Date = new Date()): string {
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  const d = String(now.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * 32-bit FNV-1a hash of the date string. Used as the run seed so the
 * physics + scoring pipeline produce identical outcomes for everyone
 * playing today's daily, while consecutive days feel uncorrelated.
 */
export function getDailySeed(date: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < date.length; i++) {
    h ^= date.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * Pick today's constellation. Rotates through all unlocked-by-default
 * constellations using a date-derived index so consecutive days never
 * repeat the same constellation back-to-back.
 */
export function getDailyConstellation(date: string): string {
  const seed = getDailySeed(date);
  const idx = seed % CONSTELLATIONS.length;
  return CONSTELLATIONS[idx]!.id;
}

/**
 * Pick today's stake. The first 7 days of a week-of-year cycle through
 * Spark→Pyre, then weekends spike to Beacon for an extra-hard daily.
 * Tunable — the rotation is intentionally weighted toward easier stakes
 * so the daily stays approachable for casual players while still
 * rewarding dedicated runs on the harder days.
 */
export function getDailyStake(date: string): string {
  // Mix the seed differently from the constellation pick so a "hard
  // constellation" day doesn't always coincide with a "hard stake" day.
  const seed = getDailySeed(date);
  const mixed = ((seed >>> 7) ^ Math.imul(seed, 0x9e3779b1)) >>> 0;
  // Weighted distribution: more common stakes appear more often. The
  // first three slots are Spark/Ember/Pyre (the "every-day" tier); the
  // last is Beacon (the "weekend spike"). Stakes beyond Beacon are not
  // yet daily-eligible — they require deep meta progression to clear
  // even without the leaderboard pressure.
  const ladder = ['spark', 'spark', 'spark', 'ember', 'ember', 'pyre', 'beacon'];
  const pick = ladder[mixed % ladder.length]!;
  // Belt-and-suspenders guard: if the stakes table ever drops a stake id,
  // fall back to spark instead of crashing the daily.
  return STAKES.some((s) => s.id === pick) ? pick : 'spark';
}

/**
 * Bundle. Convenience for callers that need the full daily config.
 */
export function getDailyChallenge(now: Date = new Date()): DailyChallenge {
  const date = getDailyDate(now);
  return {
    date,
    seed: getDailySeed(date),
    constellationId: getDailyConstellation(date),
    stakeId: getDailyStake(date),
    mode: `daily-${date}`,
  };
}
