import { register } from '../registry';
import { Phase } from '../../pipeline/types';

register({
  id: 'prophet',
  phase: Phase.UPGRADES,
  priority: 10,
  apply: (ctx) => {
    const sixes = (ctx.sim?.finalFaces ?? []).filter((f) => f === 6).length;
    if (sixes === 0) return ctx;
    const delta = sixes * 4;
    return {
      ...ctx,
      chips: ctx.chips + delta,
      events: [
        ...ctx.events,
        {
          type: 'onUpgradeTriggered',
          payload: { id: 'prophet', phase: Phase.UPGRADES, deltaChips: delta, deltaMult: 0 },
        },
      ],
    };
  },
});
