// src-next/core/phases/applyAffixes.ts
// Scoring-pipeline phase. Runs each affix's effect function with the
// shared AffixContext. The phase composer should only call this when
// run.mode === 'void'; behaviour outside void is undefined (and never
// invoked).

import type { AffixContext, AffixedItem } from '../../voidmode/types';
import type { CatalystMeta } from '../../data/catalysts';
import type { PhaseFn } from '../pipeline/types';
import { collectAffixedItems, buildAffixContext } from '../../voidmode/voidRun';

export function applyAffixes(
  ctx: AffixContext,
  items: ReadonlyArray<AffixedItem<CatalystMeta>>,
): void {
  for (const item of items) {
    for (const affix of item.affixes) {
      affix.effect(ctx);
    }
  }
}

// Pipeline-shape adapter. STRICT no-op outside void mode — returns ctx
// unchanged so the 50+ existing catalyst tests see identical behaviour.
// In void mode, builds an AffixContext from the live PipelineCtx and
// folds the resulting chipsBonus/multBonus into the running chips/mult
// accumulators. Gold is handled by the economy phase elsewhere; for now
// it accumulates onto ctx.chips? No — there's no gold-bonus accumulator
// on PipelineCtx today, so goldBonus is recorded only on the affix
// context. Phase 5 (shop hook) will wire payout once the run mode owns
// a gold counter.
export const applyAffixesPhase: PhaseFn = (ctx) => {
  if (ctx.state.run.mode !== 'void') return ctx;
  const items = collectAffixedItems(ctx.state);
  if (items.length === 0) return ctx;

  const comboId = ctx.combo?.id ?? '';
  const finalFaces = ctx.sim?.finalFaces ?? [];
  const order = ctx.state.round.scoringOrder ?? finalFaces.map((_, i) => i);
  const heldIdxs = order.filter((idx) => idx >= 0 && idx < finalFaces.length);
  const diceValues = heldIdxs.map((i) => {
    const raw = finalFaces[i];
    return typeof raw === 'number' && raw >= 0 ? raw : 0;
  });
  const isWild = heldIdxs.map((i) => finalFaces[i] === -1);

  const affixCtx = buildAffixContext({
    comboId,
    diceValues,
    isWild,
    discardsRemaining: ctx.state.round.rerollsLeft,
    handsRemaining: ctx.state.round.handsLeft,
    catalystsOwned: ctx.state.run.catalysts.length,
    goldHeld: ctx.state.run.shards,
    seedDigit: ctx.state.run.seed % 10,
    rollsThisTrial: ctx.state.run.rollCounter ?? 0,
    isBossBlind: ctx.state.round.isBoss,
  });

  applyAffixes(affixCtx, items);

  if (
    affixCtx.chipsBonus === 0 &&
    affixCtx.multBonus === 0 &&
    affixCtx.goldBonus === 0
  ) {
    return ctx;
  }

  return {
    ...ctx,
    chips: ctx.chips + affixCtx.chipsBonus,
    mult: ctx.mult + affixCtx.multBonus,
  };
};
