// Stargazer Prestige Tiers — lifetime Cosmic Dust thresholds that
// confer a permanent badge displayed in the Hub and (eventually) on the
// online leaderboard. Pure cosmetic for v1; cosmetic-unlock hooks can
// layer on top in a follow-up. The point is the number-go-up — players
// who have crossed 100k lifetime dust deserve to see it in the corner
// of every screen they visit.
//
// Driven by `meta.cosmicDustLifetime` which is already tracked
// (state/slices/meta.ts:27 — accumulates on every dust grant and is
// never decremented on spend). No state migration needed — legacy
// players see their tier the moment this ships.

export type PrestigeTierDef = {
  id: string;
  // Display label shown next to the player name + on the badge.
  name: string;
  // Lifetime dust required to enter this tier. 0 for the implicit
  // baseline tier ("Wanderer") so every player starts at tier index 0.
  threshold: number;
  // Color used for the badge ring + text accent.
  color: string;
  // Roman numeral or symbol shown inside the badge ring.
  glyph: string;
};

// Tiers are evaluated in declaration order; the player's tier is the
// LAST tier whose threshold they meet. Adding a new tier between two
// existing ones is safe — no migration, just inserts a new band into
// the ladder.
export const PRESTIGE_TIERS: PrestigeTierDef[] = [
  { id: 'wanderer',   name: 'Wanderer',   threshold: 0,        color: '#7a6fa6', glyph: '◇' },
  { id: 'spark',      name: 'Spark',      threshold: 500,      color: '#7be3ff', glyph: 'I' },
  { id: 'kindling',   name: 'Kindling',   threshold: 2_000,    color: '#7be3ff', glyph: 'II' },
  { id: 'ember',      name: 'Ember',      threshold: 5_000,    color: '#cc88ff', glyph: 'III' },
  { id: 'pyre',       name: 'Pyre',       threshold: 12_000,   color: '#cc88ff', glyph: 'IV' },
  { id: 'beacon',     name: 'Beacon',     threshold: 25_000,   color: '#f5c451', glyph: 'V' },
  { id: 'nova',       name: 'Nova',       threshold: 75_000,   color: '#f5c451', glyph: 'VI' },
  { id: 'supernova',  name: 'Supernova',  threshold: 250_000,  color: '#ff7847', glyph: 'VII' },
  { id: 'singularity', name: 'Singularity', threshold: 1_000_000, color: '#ff4d6d', glyph: '★' },
];

/**
 * Get the player's current prestige tier from their lifetime dust total.
 * Always returns a tier (Wanderer at minimum). Pure function.
 */
export function currentPrestigeTier(lifetimeDust: number): PrestigeTierDef {
  let current = PRESTIGE_TIERS[0]!;
  for (const t of PRESTIGE_TIERS) {
    if (lifetimeDust >= t.threshold) current = t;
    else break;
  }
  return current;
}

/**
 * Get the next prestige tier the player is working toward, plus the
 * lifetime-dust gap. Returns null when the player is at the highest
 * tier (no further progression).
 */
export function nextPrestigeTier(
  lifetimeDust: number,
): { tier: PrestigeTierDef; gap: number } | null {
  for (const t of PRESTIGE_TIERS) {
    if (lifetimeDust < t.threshold) {
      return { tier: t, gap: t.threshold - lifetimeDust };
    }
  }
  return null;
}
