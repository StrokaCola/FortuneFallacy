// Compounding Bias: additive +0.10× mult per cleared trial in the run,
// reset on bust. Buffed 2026-05-08 from +0.05 after the impact sweep
// (Δ +3.7% on Lyra/Spark) showed the additive snowball was outclassed
// by the new Momentum catalyst (which multiplies). Keeping CB as the
// "additive" lane and Momentum as the "multiplicative" lane — owning
// both stacks intentionally hard.
import { register } from '../registry';
import { Phase } from '../../pipeline/types';

const BONUS_PER_STACK = 0.10;

register({
  id: 'compounding_bias',
  phase: Phase.UPGRADES,
  priority: 80,
  apply: (ctx) => {
    const stacks = ctx.state.run.compoundingStacks;
    if (stacks <= 0) return ctx;
    const newMult = ctx.mult * (1 + stacks * BONUS_PER_STACK);
    return {
      ...ctx,
      mult: newMult,
      events: [
        ...ctx.events,
        {
          type: 'onUpgradeTriggered',
          payload: {
            id: 'compounding_bias',
            phase: Phase.UPGRADES,
            deltaChips: 0,
            deltaMult: newMult - ctx.mult,
          },
        },
      ],
    };
  },
});
