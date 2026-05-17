import { register } from '../registry';
import { Phase } from '../../pipeline/types';
import { comboContains } from '../../scoring/comboContains';

register({
  id: 'twin_sample',
  phase: Phase.UPGRADES,
  priority: 60,
  // 2026-05-16 — "contains" semantics. Two Pair is also embedded in a
  // Full House (XXX YY has two distinct values with ≥2 occurrences),
  // so this catalyst now fires on FH in addition to 2-pair hands.
  // 4oak / 5oak do NOT contain Two Pair (only one distinct value).
  apply: (ctx) => {
    if (!comboContains(ctx.combo?.id, 'two_pair')) return ctx;
    const newChips = ctx.chips * 2;
    return {
      ...ctx,
      chips: newChips,
      events: [
        ...ctx.events,
        {
          type: 'onUpgradeTriggered',
          payload: { id: 'twin_sample', phase: Phase.UPGRADES, deltaChips: newChips - ctx.chips, deltaMult: 0 },
        },
      ],
    };
  },
});
