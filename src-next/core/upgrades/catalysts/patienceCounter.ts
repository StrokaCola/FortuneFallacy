import { register } from '../registry';
import { Phase } from '../../pipeline/types';

const TRIGGER_INTERVAL = 5;
const MULT_VALUE = 3;

register({
  id: 'patience_counter',
  phase: Phase.UPGRADES,
  priority: 150,
  apply: (ctx) => {
    // handsPlayed is incremented AFTER this hand by the SCORE_HAND handler.
    // The current hand number = handsPlayed + 1.
    const isFifthHand = (ctx.state.run.handsPlayed + 1) % TRIGGER_INTERVAL === 0;
    if (!isFifthHand) return ctx;
    const newMult = ctx.mult * MULT_VALUE;
    return {
      ...ctx,
      mult: newMult,
      events: [
        ...ctx.events,
        {
          type: 'onUpgradeTriggered',
          payload: {
            id: 'patience_counter',
            phase: Phase.UPGRADES,
            deltaChips: 0,
            deltaMult: newMult - ctx.mult,
          },
        },
      ],
    };
  },
});
