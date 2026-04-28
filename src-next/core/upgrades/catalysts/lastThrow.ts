import { register } from '../registry';
import { Phase } from '../../pipeline/types';

const CHIP_BONUS = 25;

register({
  id: 'last_throw',
  phase: Phase.UPGRADES,
  priority: 30,
  apply: (ctx) => {
    if (ctx.state.round.handsLeft !== 1) return ctx;
    return {
      ...ctx,
      chips: ctx.chips + CHIP_BONUS,
      events: [
        ...ctx.events,
        {
          type: 'onUpgradeTriggered',
          payload: {
            id: 'last_throw',
            phase: Phase.UPGRADES,
            deltaChips: CHIP_BONUS,
            deltaMult: 0,
          },
        },
      ],
    };
  },
});
