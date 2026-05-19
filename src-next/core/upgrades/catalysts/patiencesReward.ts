// Wave T (Batch E) — Patience's Reward.
//
// All dice locked at score time → ×1.8 mult. Rewards the "lock-and-hold"
// play pattern that no existing catalyst incentivizes; pairs with
// crescendo_run (rewards no-lock) as an asymmetric tradeoff archetype.
//
// Rare timing.

import { register } from '../registry';
import { Phase } from '../../pipeline/types';

const MULT_BONUS = 0.8; // ×1.8 = base 1.0 + 0.8

register({
  id: 'patiences_reward',
  phase: Phase.UPGRADES,
  priority: 35,
  apply: (ctx) => {
    const dice = ctx.state.round.dice;
    if (dice.length === 0) return ctx;
    if (!dice.every((d) => d.locked)) return ctx;
    return {
      ...ctx,
      mult: ctx.mult + MULT_BONUS,
      events: [
        ...ctx.events,
        {
          type: 'onUpgradeTriggered',
          payload: {
            id: 'patiences_reward',
            phase: Phase.UPGRADES,
            deltaChips: 0,
            deltaMult: MULT_BONUS,
          },
        },
      ],
    };
  },
});
