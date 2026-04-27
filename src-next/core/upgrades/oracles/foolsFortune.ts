import { register } from '../registry';
import { Phase } from '../../pipeline/types';

register({
  id: 'fools_fortune',
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
          payload: { id: 'fools_fortune', phase: Phase.UPGRADES, deltaChips: newChips - ctx.chips, deltaMult: 0 },
        },
      ],
    };
  },
});
