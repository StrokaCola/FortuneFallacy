// Per-constellation unlock predicates. Lyra ships unlocked; the other 7
// constellations gate behind these conditions. Mirrors the achievements
// predicate shape (data/achievements.ts) and is consumed by the
// constellation-unlock listener (core/constellations/listener.ts), which
// runs each predicate on relevant bus events + every store change and
// dispatches UNLOCK_CONSTELLATION for any that fire.
//
// New constellations: append an entry with id, a player-facing description
// for the locked card tooltip, and a pure predicate.

import type { GameState } from '../state/store';
import type { GameEventEmission } from '../events/types';

export type ConstellationUnlockDef = {
  id: string;
  description: string;
  check: (state: GameState, event: GameEventEmission | null) => boolean;
};

const isWonRunEnd = (e: GameEventEmission | null) =>
  e?.type === 'onRunEnded' && e.payload.won === true;

// Count of distinct constellations the player has ever won on. stakeProgress
// only gains an entry when a run is cleared (upgradeStakeProgress in
// transitions.ts), so its key set is the authoritative "won-on" tally.
const distinctConstellationWins = (s: GameState): number =>
  Object.keys(s.meta.stakeProgress ?? {}).length;

export const CONSTELLATION_UNLOCKS: ConstellationUnlockDef[] = [
  {
    id: 'mensa',
    description: 'Win a run on Lyra.',
    check: (s, e) => isWonRunEnd(e) && s.run.constellationId === 'lyra',
  },
  {
    id: 'triumvirate',
    description: 'Score Three of a Kind or better in any run.',
    // Combo tiers (core/scoring/combos.ts): three_kind=3, sm_straight=4,
    // full_house=5, lg_straight=6, four_kind=7, five_kind=8. Anything
    // tier >= 3 counts as "three of a kind or better".
    check: (_s, e) =>
      e?.type === 'onComboDetected' && e.payload.tier >= 3,
  },
  {
    id: 'argo',
    description: 'Finish a run with 5+ catalysts owned.',
    check: (s, e) =>
      e?.type === 'onRunEnded' && s.run.catalysts.length >= 5,
  },
  {
    id: 'fibonacci',
    description: 'Score a Straight (small or large) in any run.',
    check: (_s, e) =>
      e?.type === 'onComboDetected' &&
      (e.payload.combo === 'sm_straight' || e.payload.combo === 'lg_straight'),
  },
  {
    id: 'eclipse',
    description: 'Clear a Boss Blind.',
    // Boss blinds resolve to one of BOSS_BLINDS ids (data/blinds.ts).
    // The simpler check is s.round.isBoss at the moment of clear — and
    // onBlindCleared fires from clearBlind() with s.round.isBoss true.
    check: (s, e) => e?.type === 'onBlindCleared' && s.round.isBoss === true,
  },
  {
    id: 'polyhedra',
    description: 'Discover 15 unique catalysts.',
    check: (s) => (s.meta.discovered?.catalysts ?? []).length >= 15,
  },
  {
    id: 'ophiuchus',
    description: 'Win runs on 3 different constellations.',
    // Includes the run that just won — stakeProgress is upgraded in the
    // same clearBlind() reducer call that emits onRunEnded, so by the
    // time the listener evaluates this on onRunEnded the count is
    // already correct.
    check: (s, e) => isWonRunEnd(e) && distinctConstellationWins(s) >= 3,
  },
];

export function lookupConstellationUnlock(id: string): ConstellationUnlockDef | undefined {
  return CONSTELLATION_UNLOCKS.find((u) => u.id === id);
}
