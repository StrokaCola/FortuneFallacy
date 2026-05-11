// Comet Trail: +10 chips per stack. Stacks accumulate per cleared blind
// in transitions.clearBlind WHEN no consumable was used during that blind.
// USE_CONSUMABLE resets the counter via consumable.ts.
import { register } from '../registry';
import { Phase } from '../../pipeline/types';
import { emitUpgrade } from './_helpers';

const CHIPS_PER_STACK = 10;

register({
  id: 'comet_trail',
  phase: Phase.UPGRADES,
  priority: 14,
  apply: (ctx) => {
    const stacks = ctx.state.run.catalystStacks?.['comet_trail'] ?? 0;
    if (stacks <= 0) return ctx;
    const delta = stacks * CHIPS_PER_STACK;
    return {
      ...ctx,
      chips: ctx.chips + delta,
      events: emitUpgrade(ctx, 'comet_trail', delta, 0),
    };
  },
});
