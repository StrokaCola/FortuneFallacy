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
// Phase 8 will add `dailySeed.getTodayCertified` — for Phase 6 we
// hard-default `certified=false` because no seed-certification table
// exists yet.

export function collectAffixedItems(state: GameState): AffixedItem<CatalystMeta>[] {
  if (state.run.mode !== 'void') return [];
  const out: AffixedItem<CatalystMeta>[] = [];
  for (const id of state.run.catalysts) {
    const affixed = state.run.catalystAffixes[id];
    if (affixed) out.push(affixed);
  }
  return out;
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
// the START_VOID_RUN action. Auto-generates a seed when one isn't
// supplied (XOR'd Date.now ^ Math.random so distinct tabs opened in the
// same millisecond don't collide). Run alias is deterministic from the
// voidSeed — same seed = same alias for screenshot/share purposes.
export function startVoidRun(opts: { seed?: number } = {}): void {
  const seed =
    typeof opts.seed === 'number'
      ? (opts.seed >>> 0)
      : ((Date.now() ^ Math.floor(Math.random() * 0xFFFFFFFF)) >>> 0);
  const rng = mulberry32(seed);
  const alias = generateRunAlias(rng);
  dispatch({
    type: 'START_VOID_RUN',
    seed,
    voidSeed: seed,
    runAlias: alias,
    dailyCertified: false,
  });
}

export function endVoidRun(): void {
  dispatch({ type: 'END_VOID_RUN' });
}
