// Straight Signal: Small Straight → +6 mult.
import { register } from '../registry';
import { Phase } from '../../pipeline/types';
import { emitUpgrade } from './_helpers';

register({
  id: 'straight_signal',
  phase: Phase.UPGRADES,
  priority: 55,
  apply: (ctx) => {
    if (ctx.combo?.id !== 'sm_straight') return ctx;
    return {
      ...ctx,
      mult: ctx.mult + 6,
      events: emitUpgrade(ctx, 'straight_signal', 0, 6),
    };
  },
});
