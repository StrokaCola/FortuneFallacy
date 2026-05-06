import { register } from '../registry';
import { Phase } from '../../pipeline/types';

register({
  id: 'pair_dynamo',
  phase: Phase.UPGRADES,
  priority: 50,
  apply: (ctx) => {
    if (ctx.combo?.id !== 'one_pair') return ctx;
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
