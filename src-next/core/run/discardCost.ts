// src-next/core/run/discardCost.ts
// Selector for the per-reroll cost gate. In normal mode each
// REROLL_REQUESTED consumes 1 reroll from the per-hand budget. In void
// mode, blind affixes can attach a `discardCostMultiplier` rule that
// scales the cost up — the player still spends from the same budget,
// but each reroll consumes `multiplier` units instead of 1.
//
// Multiple discardCostMultiplier rules compose multiplicatively, matching
// the "rules stack" intuition: two 2× rules form a 4× discard cost.
//
// Phase 2B.2 — kept in a dedicated module so the test surface stays
// narrow and any future rule kinds that affect costs land here too.

import type { BlindRule } from '../../voidmode/types';

const BASE_DISCARD_COST = 1;

/** Effective per-reroll cost given a set of active blind rules.
 *  Outside void mode (or with no rules) returns the base cost so the
 *  call site stays uniform. Multiplier products are always rounded UP
 *  via Math.ceil so the player can never sneak a half-cost off non-
 *  integer multipliers; the ceil is no-op for the integer multipliers
 *  the affix catalog actually ships. */
export function effectiveDiscardCost(rules: ReadonlyArray<BlindRule>): number {
  let mult = 1;
  for (const r of rules) {
    if (r.kind === 'discardCostMultiplier') mult *= r.multiplier;
  }
  return Math.max(1, Math.ceil(BASE_DISCARD_COST * mult));
}
