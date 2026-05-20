// src-next/voidmode/dailySeed.ts
// Date -> certified-void-seed lookup. Mirrors online/dailyChallenge.ts
// (UTC-day key + FNV-1a-style derivation), but reads pre-balance-sim-
// validated entries from dailyCertified.json instead of computing on
// the fly. This is what gives the daily leaderboard parity: every
// player on the same UTC day plays the same vetted seed.

import certified from './dailyCertified.json';

export interface CertifiedEntry {
  date: string;
  seed: number;
  clearRate: number;
}

export function getVoidDailyDate(now: Date = new Date()): string {
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  const d = String(now.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

const ENTRIES = certified.entries as CertifiedEntry[];
const BY_DATE: ReadonlyMap<string, CertifiedEntry> = new Map(
  ENTRIES.map((e) => [e.date, e]),
);

export function getTodayCertified(now: Date = new Date()): CertifiedEntry | undefined {
  return BY_DATE.get(getVoidDailyDate(now));
}

export function getCertifiedFor(date: string): CertifiedEntry | undefined {
  return BY_DATE.get(date);
}

// Returns the leaderboard mode string for the current void submission.
// Non-certified void runs are not leaderboard-eligible (returns null);
// upstream submission code should skip submission when this is null.
export function voidLeaderboardMode(certified: boolean, now: Date = new Date()): string | null {
  if (!certified) return null;
  return `void-${getVoidDailyDate(now)}`;
}
