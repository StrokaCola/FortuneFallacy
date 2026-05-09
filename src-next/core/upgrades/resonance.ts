// Resonance application — fires once per scoring hand for each owned
// pair. Lives outside the per-catalyst registry because resonances are
// emergent (only fire when BOTH halves are present) rather than per-
// catalyst attached. Slots cleanly into core/phases/upgrades.ts after
// the main loop so a pair's bonus rides any earlier catalyst multipliers.

import { Phase, type PhaseFn } from '../pipeline/types';
import { activeResonances, type ResonanceDef } from '../../data/resonances';

// Apply all active resonance pairs once. Each pair contributes flat
// chips and/or mult to the running totals and emits an
// onUpgradeTriggered event with id `resonance:<pairId>` so the strip
// can pulse both halves and the score sequence can show the named beat.
export const applyResonances: PhaseFn = (ctx) => {
  const owned = ctx.state.run.catalysts;
  const pairs = activeResonances(owned);
  if (pairs.length === 0) return ctx;

  let chips = ctx.chips;
  let mult = ctx.mult;
  const events = [...ctx.events];
  for (const pair of pairs) {
    const { dChips, dMult } = effectDeltas(pair);
    if (dChips === 0 && dMult === 0) continue;
    chips += dChips;
    mult += dMult;
    events.push({
      type: 'onUpgradeTriggered',
      payload: {
        id: `resonance:${pair.id}`,
        phase: Phase.UPGRADES,
        deltaChips: dChips,
        deltaMult: dMult,
      },
    });
  }
  return { ...ctx, chips, mult, events };
};

function effectDeltas(pair: ResonanceDef): { dChips: number; dMult: number } {
  switch (pair.effect.kind) {
    case 'chips':
      return { dChips: pair.effect.value, dMult: 0 };
    case 'mult':
      return { dChips: 0, dMult: pair.effect.value };
    case 'both':
      return { dChips: pair.effect.chips, dMult: pair.effect.mult };
  }
}
