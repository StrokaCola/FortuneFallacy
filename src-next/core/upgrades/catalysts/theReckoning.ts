// The Reckoning — First hand of every blind: Mult ×2 and +50 chips.
// Stacks with Lucky Streak (which fires the same condition with
// different numerics) for a "first hand is everything" build.
//
// Fires when handsLeft === handsMax (no hands played yet in this
// blind). Resets implicitly each START_BLIND.
import { register } from '../registry';
import { Phase } from '../../pipeline/types';
import { emitUpgrade } from './_helpers';

register({
  id: 'the_reckoning',
  phase: Phase.UPGRADES,
  priority: 145,
  apply: (ctx) => {
    const handsLeft = ctx.state.round.handsLeft ?? 0;
    const handsMax = ctx.state.round.handsMax ?? 0;
    if (handsLeft !== handsMax) return ctx;
    const multBefore = ctx.mult;
    const multAfter = multBefore * 2;
    return {
      ...ctx,
      chips: ctx.chips + 50,
      mult: multAfter,
      events: emitUpgrade(ctx, 'the_reckoning', 50, multAfter - multBefore),
    };
  },
});
