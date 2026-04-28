import { register } from '../registry';
import { Phase } from '../../pipeline/types';

register({
  id: 'chaos_theory',
  phase: Phase.UPGRADES,
  priority: 50,
  apply: (ctx) => {
    const id = ctx.combo?.id;
    if (id !== 'sm_straight' && id !== 'lg_straight') return ctx;
    return {
      ...ctx,
      mult: ctx.mult + 5,
      events: [
        ...ctx.events,
        {
          type: 'onUpgradeTriggered',
          payload: { id: 'chaos_theory', phase: Phase.UPGRADES, deltaChips: 0, deltaMult: 5 },
        },
      ],
    };
  },
});
