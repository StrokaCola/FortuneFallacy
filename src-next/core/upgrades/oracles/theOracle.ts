import { register } from '../registry';
import { Phase } from '../../pipeline/types';

register({
  id: 'the_oracle',
  phase: Phase.UPGRADES,
  priority: 100,
  apply: (ctx) => {
    if (ctx.combo?.id !== 'full_house') return ctx;
    const newMult = ctx.mult * 2;
    return {
      ...ctx,
      mult: newMult,
      events: [
        ...ctx.events,
        {
          type: 'onUpgradeTriggered',
          payload: {
            id: 'the_oracle',
            phase: Phase.UPGRADES,
            deltaChips: 0,
            deltaMult: newMult - ctx.mult,
          },
        },
      ],
    };
  },
});
