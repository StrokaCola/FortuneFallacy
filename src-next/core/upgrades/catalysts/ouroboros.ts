// Ouroboros: +3 mult per stack. Stacks accumulate when the player scores
// the same combo tier 3× consecutively in a single blind. The "current
// blind streak" lives in round state; the permanent stack lives in
// catalystStacks. See actions/handlers/roll.ts SCORE_HAND for accrual.
import { register } from '../registry';
import { Phase } from '../../pipeline/types';
import { emitUpgrade } from './_helpers';

const MULT_PER_STACK = 3;

register({
  id: 'ouroboros',
  phase: Phase.UPGRADES,
  priority: 86,
  apply: (ctx) => {
    const stacks = ctx.state.run.catalystStacks?.['ouroboros'] ?? 0;
    if (stacks <= 0) return ctx;
    const delta = stacks * MULT_PER_STACK;
    return {
      ...ctx,
      mult: ctx.mult + delta,
      events: emitUpgrade(ctx, 'ouroboros', 0, delta),
    };
  },
});
