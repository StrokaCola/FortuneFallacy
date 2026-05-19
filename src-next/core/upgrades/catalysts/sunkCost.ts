// Wave T (Batch E) — Sunk Cost.
//
// Each reroll used this blind multiplies the current hand's mult by
// 0.85. Cumulative across hands; resets when the blind ends. Tradeoff
// catalyst — punishes spam-rerolling, rewards committing to a line.
//
// Rare risk archetype.
//
// Reads round.rerollsUsedThisBlind (incremented in REROLL_REQUESTED).

import { register } from '../registry';
import { Phase } from '../../pipeline/types';

const PENALTY = 0.85;

register({
  id: 'sunk_cost',
  phase: Phase.UPGRADES,
  priority: 38,
  apply: (ctx) => {
    const used = ctx.state.round.rerollsUsedThisBlind ?? 0;
    if (used === 0) return ctx;
    // Multiplicative penalty applies to the current hand's accumulated
    // mult. Each reroll compounds, so a player who rerolls four times
    // across a blind scores at 0.85^4 ≈ 0.52× the mult they'd have
    // earned otherwise.
    const factor = Math.pow(PENALTY, used);
    const before = ctx.mult;
    const after = ctx.mult * factor;
    const deltaMult = after - before;
    return {
      ...ctx,
      mult: after,
      events: [
        ...ctx.events,
        {
          type: 'onUpgradeTriggered',
          payload: {
            id: 'sunk_cost',
            phase: Phase.UPGRADES,
            deltaChips: 0,
            deltaMult,
          },
        },
      ],
    };
  },
});
