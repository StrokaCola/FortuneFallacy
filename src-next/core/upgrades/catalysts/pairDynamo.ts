import { register } from '../registry';
import { Phase } from '../../pipeline/types';
import { comboContains } from '../../scoring/comboContains';

register({
  id: 'pair_dynamo',
  phase: Phase.UPGRADES,
  priority: 50,
  // 2026-05-16 — "contains" semantics. Pair Dynamo now fires on any
  // hand that contains a pair (1p, 2p, 3oak, FH, 4oak, 5oak), not just
  // when the detected combo is exactly One Pair. See comboContains.ts
  // for the containment table.
  apply: (ctx) => {
    if (!comboContains(ctx.combo?.id, 'one_pair')) return ctx;
    return {
      ...ctx,
      mult: ctx.mult + 5,
      events: [
        ...ctx.events,
        {
          type: 'onUpgradeTriggered',
          payload: { id: 'pair_dynamo', phase: Phase.UPGRADES, deltaChips: 0, deltaMult: 5 },
        },
      ],
    };
  },
});
