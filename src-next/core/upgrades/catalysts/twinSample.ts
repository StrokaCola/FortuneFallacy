import { register } from '../registry';
import { Phase } from '../../pipeline/types';

register({
  id: 'twin_sample',
  phase: Phase.UPGRADES,
  priority: 60,
  apply: (ctx) => {
    if (ctx.combo?.id !== 'two_pair') return ctx;
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
