// Memento Star: +0.5× mult per stack. Stacks accumulate at clearBlind
// when the player exceeded blind target by 200%+. See transitions.clearBlind.
import { register } from '../registry';
import { Phase } from '../../pipeline/types';
import { emitUpgrade } from './_helpers';

const MULT_PER_STACK = 0.5;

register({
  id: 'memento_star',
  phase: Phase.UPGRADES,
  priority: 84,
  apply: (ctx) => {
    const stacks = ctx.state.run.catalystStacks?.['memento_star'] ?? 0;
    if (stacks <= 0) return ctx;
    const newMult = ctx.mult * (1 + stacks * MULT_PER_STACK);
    return {
      ...ctx,
      mult: newMult,
      events: emitUpgrade(ctx, 'memento_star', 0, newMult - ctx.mult),
    };
  },
});
