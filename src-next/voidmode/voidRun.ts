// src-next/voidmode/voidRun.ts
// Helpers used by the scoring pipeline to bridge void-mode state into
// the affix-application phase. The run lifecycle (startVoidRun/endVoidRun)
// arrives in Phase 6 — this file currently only hosts the integration
// helpers.

import type { GameState } from '../state/store';
import type { AffixedItem, AffixContext } from './types';
import type { CatalystMeta } from '../data/catalysts';

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
