// Double or Nothing (2026-05-18 audit add): risk rare. Each hand,
// 50% chance Mult ×2; otherwise Mult ×0.5. Expected value ×1.25
// (0.5×2 + 0.5×0.5) with the audit's stated "50% variance" floor.
//
// Spec note: the 2026-05-16 audit doc framed this as 25% ×2 / 75%
// ×0.5, but that yields an EV of 0.875 (below 1.0). The stated
// "Expected ×1.25" requires a 50/50 split — which we ship here.
//
// Deterministic: uses ctx.rng (seeded from the run seed + roll
// counter), so a given seed produces the same gamble outcome on
// replay. The 0.50 threshold reads directly from the seeded stream.
//
// Priority 220 — late enough that other multiplicative scaling has
// already fired (Tempo, Prime Resonance, Nova Burst) so the
// doubling lands on the fully-built mult.

import { register } from '../registry';
import { Phase } from '../../pipeline/types';
import { emitUpgrade } from './_helpers';

const WIN_THRESHOLD = 0.5;
const WIN_MULT = 2;
const LOSE_MULT = 0.5;

register({
  id: 'double_or_nothing',
  phase: Phase.UPGRADES,
  priority: 220,
  apply: (ctx) => {
    if (ctx.mult <= 0) return ctx;
    const won = ctx.rng.next() < WIN_THRESHOLD;
    const factor = won ? WIN_MULT : LOSE_MULT;
    const newMult = ctx.mult * factor;
    return {
      ...ctx,
      mult: newMult,
      events: emitUpgrade(ctx, 'double_or_nothing', 0, newMult - ctx.mult),
    };
  },
});
