// src-next/voidmode/voidRun.ts
// Helpers used by the scoring pipeline to bridge void-mode state into
// the affix-application phase + the public lifecycle helpers (start/end)
// used by the title-screen BlackHole entry point.

import type { GameState } from '../state/store';
import type { AffixedItem, AffixContext } from './types';
import type { CatalystMeta } from '../data/catalysts';
import { dispatch } from '../actions/dispatch';
import { mulberry32 } from '../core/rng';
import { generateRunAlias } from './nameGenerator';
import { getTodayCertified } from './dailySeed';

export function collectAffixedItems(state: GameState): AffixedItem<CatalystMeta>[] {
  if (state.run.mode !== 'void') return [];
  const out: AffixedItem<CatalystMeta>[] = [];
  for (const id of state.run.catalysts) {
    const affixed = state.run.catalystAffixes[id];
    if (affixed) out.push(affixed);
  }
  return out;
}

// Returns the affixed-item record for the BLIND currently being scored
// (if any). Phase 2B.1 — the scoring pipeline reads this alongside
// collectAffixedItems so blind affixes fire through the same
// applyAffixes phase as catalyst affixes. Returns null outside void
// mode, when no blind is active, or when the blind has no rolled
// affix (e.g. blinds without archetypeTags, or a save that predates
// the field). Generic over `unknown` so the existing applyAffixes
// signature (AffixedItem<CatalystMeta>) accepts the result via the
// shared shape — the effect function only touches the shared context,
// not base-typed fields.
export function collectActiveBlindAffixed(state: GameState): AffixedItem<unknown> | null {
  if (state.run.mode !== 'void') return null;
  const blindId = state.round.blindId;
  if (!blindId) return null;
  const affixed = (state.run.blindAffixes ?? {})[blindId];
  if (!affixed) return null;
  // Skip noop entries — applyAffixes would just iterate an empty array.
  if (affixed.affixes.length === 0) return null;
  return affixed as AffixedItem<unknown>;
}

// Build an AffixContext from the live scoring context. The shape of the
// scoring context is codebase-specific — you may need to expand fields
// here once Phase 5 (shop integration) wires real combo/hand state.
export function buildAffixContext(opts: {
  comboId: string;
  diceValues: number[];
  isWild: boolean[];
  discardsRemaining: number;
  handsRemaining: number;
  catalystsOwned: number;
  goldHeld: number;
  seedDigit: number;
  rollsThisTrial: number;
  isBossBlind: boolean;
}): AffixContext {
  return {
    chipsBonus: 0,
    multBonus: 0,
    goldBonus: 0,
    hand: { comboId: opts.comboId, diceValues: opts.diceValues, isWild: opts.isWild },
    run: {
      discardsRemaining: opts.discardsRemaining,
      handsRemaining: opts.handsRemaining,
      catalystsOwned: opts.catalystsOwned,
      goldHeld: opts.goldHeld,
      seedDigit: opts.seedDigit,
    },
    trial: { rollsThisTrial: opts.rollsThisTrial, isBossBlind: opts.isBossBlind },
    scratch: {},
  };
}

// Lifecycle — start a Void Mode run. Caller-friendly wrapper around
// the START_VOID_RUN action. When no explicit seed is supplied, prefers
// today's certified seed (from dailyCertified.json) so a black-hole tap
// lands a leaderboard-eligible run on a balance-validated seed. If no
// entry exists for today, rolls a wild seed (Date.now ^ Math.random so
// distinct tabs opened in the same millisecond don't collide); wild
// runs are intentionally marked uncertified and won't submit to the
// daily leaderboard. Run alias is deterministic from voidSeed.
export function startVoidRun(opts: { seed?: number } = {}): void {
  const certified = getTodayCertified();
  const seed =
    typeof opts.seed === 'number'
      ? (opts.seed >>> 0)
      : (certified?.seed ?? ((Date.now() ^ Math.floor(Math.random() * 0xFFFFFFFF)) >>> 0));
  const rng = mulberry32(seed);
  const alias = generateRunAlias(rng);
  dispatch({
    type: 'START_VOID_RUN',
    seed,
    voidSeed: seed,
    runAlias: alias,
    dailyCertified: certified ? certified.seed === seed : false,
  });
}

export function endVoidRun(): void {
  dispatch({ type: 'END_VOID_RUN' });
}
