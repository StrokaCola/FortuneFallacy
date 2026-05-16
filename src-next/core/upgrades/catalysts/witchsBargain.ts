// Witch's Bargain — ×1.4 mult on every hand, but every scoring die
// loses 8 chips before the multiplier hits. Net positive on hands
// with rich chip pile, net negative on thin combos (Chance, low One
// Pair). Encourages the player to commit to bigger hands once
// equipped — they NEED the chips to outpace the tax.
//
// Priority 130 — runs after combo and most face catalysts so the
// chip subtraction lands on the final per-die total, and after the
// per-die "+chips" catalysts so the player isn't punished for
// catalysts that already paid them.
import { register } from '../registry';
import { Phase } from '../../pipeline/types';
import { emitUpgrade } from './_helpers';

register({
  id: 'witchs_bargain',
  phase: Phase.UPGRADES,
  priority: 130,
  apply: (ctx) => {
    const faces = ctx.sim?.finalFaces ?? [];
    const order = ctx.state.round.scoringOrder ?? faces.map((_, i) => i);
    const scoringCount = order.filter((idx) => idx >= 0 && idx < faces.length).length;
    if (scoringCount === 0) return ctx;
    const chipsLoss = Math.min(ctx.chips, scoringCount * 8);
    const chipsAfter = ctx.chips - chipsLoss;
    const multBefore = ctx.mult;
    const multAfter = multBefore * 1.4;
    return {
      ...ctx,
      chips: chipsAfter,
      mult: multAfter,
      events: emitUpgrade(ctx, 'witchs_bargain', -chipsLoss, multAfter - multBefore),
    };
  },
});
