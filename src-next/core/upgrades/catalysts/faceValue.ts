// Face Value: each scoring 4 grants +3 chips and +1 mult. Fills the
// mid-face gap (currently no 4-payer between Prime Pact for 2/3/5 and
// Iron Six / Six Bias for 6).
import { register } from '../registry';
import { Phase } from '../../pipeline/types';
import { emitUpgrade } from './_helpers';

const CHIPS_PER_FOUR = 3;
const MULT_PER_FOUR = 1;

register({
  id: 'face_value',
  phase: Phase.UPGRADES,
  priority: 15,
  apply: (ctx) => {
    const order = ctx.state.round.scoringOrder ?? [];
    const faces = ctx.sim?.finalFaces ?? [];
    let count = 0;
    for (const i of order) if (faces[i] === 4) count++;
    if (count === 0) return ctx;
    const dChips = count * CHIPS_PER_FOUR;
    const dMult = count * MULT_PER_FOUR;
    return {
      ...ctx,
      chips: ctx.chips + dChips,
      mult: ctx.mult + dMult,
      events: emitUpgrade(ctx, 'face_value', dChips, dMult),
    };
  },
});
