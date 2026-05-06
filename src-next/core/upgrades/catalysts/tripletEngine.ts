import { register } from '../registry';
import { Phase } from '../../pipeline/types';

register({
  id: 'triplet_engine',
  phase: Phase.UPGRADES,
  priority: 100,
  apply: (ctx) => {
    if (ctx.combo?.id !== 'three_kind') return ctx;
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
