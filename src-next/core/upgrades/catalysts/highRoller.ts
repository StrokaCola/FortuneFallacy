// High Roller: each scoring 5 or 6 grants +2 chips and +1 mult. Strong
// mid/upper-face payer that pairs with Iron Six (mult on 6s only) and
// Solar Flare (×1.5 mult when 3+ scoring dice are 5/6).
import { register } from '../registry';
import { Phase } from '../../pipeline/types';
import { emitUpgrade } from './_helpers';

const CHIPS_PER_FACE = 2;
const MULT_PER_FACE = 1;

register({
  id: 'high_roller',
  phase: Phase.UPGRADES,
  priority: 20,
  apply: (ctx) => {
    const order = ctx.state.round.scoringOrder ?? [];
    const faces = ctx.sim?.finalFaces ?? [];
    let count = 0;
    for (const i of order) {
      const f = faces[i];
      if (f === 5 || f === 6) count++;
    }
    if (count === 0) return ctx;
    const dChips = count * CHIPS_PER_FACE;
    const dMult = count * MULT_PER_FACE;
    return {
      ...ctx,
      chips: ctx.chips + dChips,
      mult: ctx.mult + dMult,
      events: emitUpgrade(ctx, 'high_roller', dChips, dMult),
    };
  },
});
