// Voidwalker — While in Cosmic Lap N: +N mult per owned catalyst, per
// hand. Dormant during the normal 4-ante run (lap 0 → no fire).
// Designed as the endless-mode-only payoff: the deeper the player
// pushes into endless, the harder Voidwalker scales.
import { register } from '../registry';
import { Phase } from '../../pipeline/types';
import { emitUpgrade } from './_helpers';

register({
  id: 'voidwalker',
  phase: Phase.UPGRADES,
  priority: 140,
  apply: (ctx) => {
    const lap = ctx.state.run.endlessLap ?? 0;
    if (lap <= 0) return ctx;
    const owned = ctx.state.run.catalysts.length;
    const bonus = lap * owned;
    if (bonus <= 0) return ctx;
    return {
      ...ctx,
      mult: ctx.mult + bonus,
      events: emitUpgrade(ctx, 'voidwalker', 0, bonus),
    };
  },
});
