// src-next/core/phases/applyAffixes.ts
// Scoring-pipeline phase. Runs each affix's effect function with the
// shared AffixContext. The phase composer should only call this when
// run.mode === 'void'; behaviour outside void is undefined (and never
// invoked).

import type { AffixContext, AffixedItem } from '../../voidmode/types';
import type { PhaseFn } from '../pipeline/types';
import { collectAffixedItems, collectActiveBlindAffixed, buildAffixContext } from '../../voidmode/voidRun';

export function applyAffixes(
  ctx: AffixContext,
  items: ReadonlyArray<AffixedItem<unknown>>,
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
//
// Phase 2B.2 — also applies banCombo rules (run.activeBlindRules) by
// forcing this hand's chips + mult to zero when the detected combo
// matches a banned id. The rule fires BEFORE affix effects fold so a
// banCombo-affix's compensation bonus (e.g. +N mult on non-banned
// combos via its `effect`) still rides downstream catalyst multipliers
// on the un-banned hand; on the banned hand both base + bonus collapse
// to zero. The zero-out happens at the pipeline ctx level (ctx.chips /
// ctx.mult) so subsequent phases (UPGRADES, SCORING) multiply against
// the zeroed value and the final score stays at 0.
export const applyAffixesPhase: PhaseFn = (ctx) => {
  if (ctx.state.run.mode !== 'void') return ctx;

  // Apply banCombo rule first — if the detected combo is banned this
  // blind, zero out the running chips/mult before affix effects fold so
  // the hand scores nothing regardless of catalyst bonuses downstream.
  // Outside the void mode gate this is a strict no-op.
  let next = ctx;
  const rules = ctx.state.run.activeBlindRules ?? [];
  const comboId = ctx.combo?.id ?? '';
  if (rules.length > 0 && comboId) {
    const banned = rules.find(
      (r) => r.kind === 'banCombo' && r.comboId === comboId,
    );
    if (banned) {
      next = { ...next, chips: 0, mult: 0 };
    }
  }

  const catalystItems = collectAffixedItems(next.state);
  const blindAffixed = collectActiveBlindAffixed(next.state);
  const items: AffixedItem<unknown>[] = blindAffixed
    ? [...catalystItems, blindAffixed]
    : [...catalystItems];
  if (items.length === 0) return next;

  const finalFaces = next.sim?.finalFaces ?? [];
  const order = next.state.round.scoringOrder ?? finalFaces.map((_, i) => i);
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
    discardsRemaining: next.state.round.rerollsLeft,
    handsRemaining: next.state.round.handsLeft,
    catalystsOwned: next.state.run.catalysts.length,
    goldHeld: next.state.run.shards,
    seedDigit: next.state.run.seed % 10,
    rollsThisTrial: next.state.run.rollCounter ?? 0,
    isBossBlind: next.state.round.isBoss,
  });

  applyAffixes(affixCtx, items);

  // Banned-combo hands collapse all bonuses too — the "doesn't count"
  // interpretation extends to the affix-supplied chips/mult bonuses so
  // a banCombo-affix's OWN scoring bonus doesn't smuggle points back
  // onto a hand whose combo was just neutered.
  const bannedThisHand =
    rules.length > 0 &&
    !!comboId &&
    rules.some((r) => r.kind === 'banCombo' && r.comboId === comboId);

  if (bannedThisHand) {
    // Hold chips/mult at zero; ignore the bonuses entirely.
    return next;
  }

  if (
    affixCtx.chipsBonus === 0 &&
    affixCtx.multBonus === 0 &&
    affixCtx.goldBonus === 0
  ) {
    return next;
  }

  return {
    ...next,
    chips: next.chips + affixCtx.chipsBonus,
    mult: next.mult + affixCtx.multBonus,
  };
};
