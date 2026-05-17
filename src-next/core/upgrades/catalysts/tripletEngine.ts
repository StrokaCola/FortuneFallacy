import { register } from '../registry';
import { Phase } from '../../pipeline/types';
import { comboContains } from '../../scoring/comboContains';

register({
  id: 'triplet_engine',
  phase: Phase.UPGRADES,
  priority: 100,
  // 2026-05-16 — "contains" semantics. Triplet Engine now fires on any
  // hand whose structure includes a three-of-a-kind: 3oak, Full House
  // (XXX YY), Four of a Kind (XXXX), and Five of a Kind (XXXXX) all
  // contain a 3oak as a substructure.
  apply: (ctx) => {
    if (!comboContains(ctx.combo?.id, 'three_kind')) return ctx;
    const newMult = ctx.mult * 1.75;
    return {
      ...ctx,
      mult: newMult,
      events: [
        ...ctx.events,
        {
          type: 'onUpgradeTriggered',
          payload: { id: 'triplet_engine', phase: Phase.UPGRADES, deltaChips: 0, deltaMult: newMult - ctx.mult },
        },
      ],
    };
  },
});
