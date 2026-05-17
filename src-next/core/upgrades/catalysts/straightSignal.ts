// Straight Signal: Small Straight → +6 mult.
//
// 2026-05-16 — "contains" semantics. A Large Straight (5 consecutive)
// always contains a Small Straight (4 consecutive), so Straight Signal
// now fires on lg_straight too. Magnitude (the lg_straight catalyst)
// still has its own independent payoff so 5-card runs stack both.
import { register } from '../registry';
import { Phase } from '../../pipeline/types';
import { emitUpgrade } from './_helpers';
import { comboContains } from '../../scoring/comboContains';

register({
  id: 'straight_signal',
  phase: Phase.UPGRADES,
  priority: 55,
  apply: (ctx) => {
    if (!comboContains(ctx.combo?.id, 'sm_straight')) return ctx;
    return {
      ...ctx,
      mult: ctx.mult + 6,
      events: emitUpgrade(ctx, 'straight_signal', 0, 6),
    };
  },
});
