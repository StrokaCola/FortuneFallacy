import { register } from '../registry';
import { Phase } from '../../pipeline/types';

register({
  id: 'magnitude',
  phase: Phase.UPGRADES,
  // Run at 110 — after the early single-effect catalysts (50-100) so the
  // chip-doubling here applies on top of any chip-additive catalysts.
  priority: 110,
  apply: (ctx) => {
    if (ctx.combo?.id !== 'lg_straight') return ctx;
    const newChips = ctx.chips * 2;
    const newMult = ctx.mult * 1.5;
    return {
      ...ctx,
      chips: newChips,
      mult: newMult,
      events: [
        ...ctx.events,
        {
          type: 'onUpgradeTriggered',
          payload: {
            id: 'magnitude',
            phase: Phase.UPGRADES,
            deltaChips: newChips - ctx.chips,
            deltaMult: newMult - ctx.mult,
          },
        },
      ],
    };
  },
});
