import { register } from '../registry';
import { Phase } from '../../pipeline/types';

register({
  id: 'silver_tongue',
  phase: Phase.UPGRADES,
  priority: 40,
  apply: (ctx) => {
    if (ctx.combo?.id !== 'chance') return ctx;
    return {
      ...ctx,
      mult: ctx.mult + 4,
      events: [
        ...ctx.events,
        {
          type: 'onUpgradeTriggered',
          payload: { id: 'silver_tongue', phase: Phase.UPGRADES, deltaChips: 0, deltaMult: 4 },
        },
      ],
    };
  },
});
