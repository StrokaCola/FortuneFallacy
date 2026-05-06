// Low Choir: each scoring face ≤2 grants +3 mult. Counterpart to Six Bias
// at the bottom of the d6 range — pairs with Pin One / Pin Two consumables.
import { register } from '../registry';
import { Phase } from '../../pipeline/types';
import { emitUpgrade } from './_helpers';

const MULT_PER_LOW_FACE = 3;

register({
  id: 'low_choir',
  phase: Phase.UPGRADES,
  priority: 13,
  apply: (ctx) => {
    const faces = ctx.sim?.finalFaces ?? [];
    const order = ctx.state.round.scoringOrder ?? faces.map((_, i) => i);
    const scoringFaces = order
      .filter((idx) => idx >= 0 && idx < faces.length)
      .map((i) => faces[i]!);
    const lows = scoringFaces.filter((f) => f <= 2).length;
    if (lows === 0) return ctx;
    const delta = lows * MULT_PER_LOW_FACE;
    return {
      ...ctx,
      mult: ctx.mult + delta,
      events: emitUpgrade(ctx, 'low_choir', 0, delta),
    };
  },
});
