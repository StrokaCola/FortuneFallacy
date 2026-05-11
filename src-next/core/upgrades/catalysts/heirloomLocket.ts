// Heirloom Locket: +0.15× mult per stack. Stacks accumulate one per cleared
// blind. On a successful run-end the catalyst writes HALF its current stack
// count into meta.heirloomCarryover so the NEXT run starts the catalyst
// pre-stacked. See transitions.clearBlind for both write paths.
import { register } from '../registry';
import { Phase } from '../../pipeline/types';
import { emitUpgrade } from './_helpers';

const MULT_PER_STACK = 0.15;

register({
  id: 'heirloom_locket',
  phase: Phase.UPGRADES,
  priority: 96,
  apply: (ctx) => {
    const stacks = ctx.state.run.catalystStacks?.['heirloom_locket'] ?? 0;
    if (stacks <= 0) return ctx;
    const newMult = ctx.mult * (1 + stacks * MULT_PER_STACK);
    return {
      ...ctx,
      mult: newMult,
      events: emitUpgrade(ctx, 'heirloom_locket', 0, newMult - ctx.mult),
    };
  },
});
