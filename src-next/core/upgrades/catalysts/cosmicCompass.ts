// Cosmic Compass — Each cleared blind: +0.05× mult permanent (cap
// +0.5× per ante). Uses the existing scaling-pack stack accrual via
// `accrueBlindCleared` in core/round/scalingHooks.ts (registered there
// as a per-blind incrementing scaling catalyst).
//
// Stack value = number of cleared blinds while this catalyst was owned.
// Multiplier = 1 + min(0.05 × stack, 0.5 × ante) so per-ante cap holds.
import { register } from '../registry';
import { Phase } from '../../pipeline/types';
import { emitUpgrade } from './_helpers';

register({
  id: 'cosmic_compass',
  phase: Phase.UPGRADES,
  priority: 115,
  apply: (ctx) => {
    const stack = ctx.state.run.catalystStacks?.cosmic_compass ?? 0;
    if (stack === 0) return ctx;
    const ante = ctx.state.run.ante;
    const rawBonus = 0.05 * stack;
    const capped = Math.min(rawBonus, 0.5 * ante);
    if (capped <= 0) return ctx;
    const before = ctx.mult;
    const after = before * (1 + capped);
    return {
      ...ctx,
      mult: after,
      events: emitUpgrade(ctx, 'cosmic_compass', 0, after - before),
    };
  },
});
