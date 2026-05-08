// Momentum: each cleared trial in this run multiplies the hand's mult
// by 1.4. Reads `compoundingStacks` (the same counter Compounding Bias
// uses, incremented +1 per cleared trial, reset on bust). Stacks
// multiplicatively with Compounding Bias's additive +0.05× per stack —
// owning both is intentionally explosive; this is the "snowball" lane.
import { register } from '../registry';
import { Phase } from '../../pipeline/types';
import { emitUpgrade } from './_helpers';

const MULT_PER_STACK = 0.4;

register({
  id: 'momentum',
  phase: Phase.UPGRADES,
  // Run after Compounding Bias (priority 80) so its multiplicative
  // amplification sees the post-CB mult.
  priority: 100,
  apply: (ctx) => {
    const stacks = ctx.state.run.compoundingStacks;
    if (stacks <= 0) return ctx;
    const factor = 1 + stacks * MULT_PER_STACK;
    const newMult = ctx.mult * factor;
    return {
      ...ctx,
      mult: newMult,
      events: emitUpgrade(ctx, 'momentum', 0, newMult - ctx.mult),
    };
  },
});
