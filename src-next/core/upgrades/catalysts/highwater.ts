// Highwater: +1 mult per stack. Stacks accumulate when a hand sets a new
// peakHand value. Detection in actions/handlers/roll.ts SCORE_HAND right
// after runStats is recomputed — if peakHand changed AND the player owns
// Highwater, bump the stack.
//
// Note: very first hand of every run is "a new high score" — we gate on
// `handsPlayed > 0` so the freebie doesn't fire (the player has to actually
// beat themselves).
import { register } from '../registry';
import { Phase } from '../../pipeline/types';
import { emitUpgrade } from './_helpers';

const MULT_PER_STACK = 1;

register({
  id: 'highwater',
  phase: Phase.UPGRADES,
  priority: 94,
  apply: (ctx) => {
    const stacks = ctx.state.run.catalystStacks?.['highwater'] ?? 0;
    if (stacks <= 0) return ctx;
    const delta = stacks * MULT_PER_STACK;
    return {
      ...ctx,
      mult: ctx.mult + delta,
      events: emitUpgrade(ctx, 'highwater', 0, delta),
    };
  },
});
