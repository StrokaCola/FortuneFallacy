import { register } from '../registry';
import { Phase } from '../../pipeline/types';

const BONUS_PER_STACK = 0.05;

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
