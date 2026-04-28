import { register } from '../registry';
import { Phase } from '../../pipeline/types';

register({
  id: 'catalyst_bench',
  phase: Phase.UPGRADES,
  priority: 30,
  apply: (ctx) => {
    const others = ctx.state.run.catalysts.filter((id) => id !== 'catalyst_bench').length;
    if (others <= 0) return ctx;
    return {
      ...ctx,
      mult: ctx.mult + others,
      events: [
        ...ctx.events,
        {
          type: 'onUpgradeTriggered',
          payload: {
            id: 'catalyst_bench',
            phase: Phase.UPGRADES,
            deltaChips: 0,
            deltaMult: others,
          },
        },
      ],
    };
  },
});
