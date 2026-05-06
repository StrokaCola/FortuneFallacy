// Level's Levy: each combo level on the played hand grants +1 mult.
// Pairs directly with the Galaxy system — a player who funnels Whirlpools
// into Three of a Kind sees this scale linearly with their commitment.
import { register } from '../registry';
import { Phase } from '../../pipeline/types';
import { emitUpgrade } from './_helpers';

register({
  id: 'levels_levy',
  phase: Phase.UPGRADES,
  priority: 95,
  apply: (ctx) => {
    const comboId = ctx.combo?.id;
    if (!comboId) return ctx;
    const lvl = ctx.state.run.comboLevels?.[comboId] ?? 0;
    if (lvl === 0) return ctx;
    return {
      ...ctx,
      mult: ctx.mult + lvl,
      events: emitUpgrade(ctx, 'levels_levy', 0, lvl),
    };
  },
});
