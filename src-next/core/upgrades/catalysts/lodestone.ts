// Lodestone: +2 chips per accumulated stack. Stacks accumulate on Pairs
// (one_pair) scored. Counter increment in actions/handlers/roll.ts.
import { register } from '../registry';
import { Phase } from '../../pipeline/types';
import { emitUpgrade } from './_helpers';

const CHIPS_PER_STACK = 2;

register({
  id: 'lodestone',
  phase: Phase.UPGRADES,
  priority: 12,
  apply: (ctx) => {
    const stacks = ctx.state.run.catalystStacks?.['lodestone'] ?? 0;
    if (stacks <= 0) return ctx;
    const delta = stacks * CHIPS_PER_STACK;
    return {
      ...ctx,
      chips: ctx.chips + delta,
      events: emitUpgrade(ctx, 'lodestone', delta, 0),
    };
  },
});
