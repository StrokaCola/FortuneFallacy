// Crown of Skulls — Mult ×3 every hand. The "lose 1 hand at blind
// start" downside is wired in core/round/transitions.ts startBlind
// (reduces handsMax when this catalyst is owned).
//
// True glass-cannon legendary: the upside is unconditional and large;
// the cost is real and structural (one fewer attempt per blind).
// Unlocked only after 10 cumulative Beacon+ busts (see roadmap).
import { register } from '../registry';
import { Phase } from '../../pipeline/types';
import { emitUpgrade } from './_helpers';

register({
  id: 'crown_of_skulls',
  phase: Phase.UPGRADES,
  priority: 150,
  apply: (ctx) => {
    const before = ctx.mult;
    const after = before * 3;
    return {
      ...ctx,
      mult: after,
      events: emitUpgrade(ctx, 'crown_of_skulls', 0, after - before),
    };
  },
});
