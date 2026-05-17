// Hourglass — +1 hand per blind, target +10%. The hand+target
// adjustments are NOT applied in the pipeline; they live in
// core/round/transitions.ts startBlind where handsMax + target are
// computed. This file is the registration stub so the catalyst is
// discoverable via the standard catalyst index, plus the apply
// function fires an empty trigger event so the per-card pulse system
// shows the catalyst as "active" on every hand.
//
// Mechanically a no-op in the score pipeline — all value is in the
// upstream hand/target adjustment.
import { register } from '../registry';
import { Phase } from '../../pipeline/types';

register({
  id: 'hourglass',
  phase: Phase.UPGRADES,
  priority: 5,
  apply: (ctx) => {
    return {
      ...ctx,
      events: [
        ...ctx.events,
        {
          type: 'onUpgradeTriggered',
          payload: { id: 'hourglass', phase: Phase.UPGRADES, deltaChips: 0, deltaMult: 0 },
        },
      ],
    };
  },
});
