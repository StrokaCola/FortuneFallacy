// Solar Flare: if 3 or more SCORING dice show 5 or 6, multiply mult by 1.5.
import { register } from '../registry';
import { Phase } from '../../pipeline/types';
import { emitUpgrade } from './_helpers';

const MULT_VALUE = 1.5;
const THRESHOLD = 3;

register({
  id: 'solar_flare',
  phase: Phase.UPGRADES,
  priority: 120,
  apply: (ctx) => {
    const faces = ctx.sim?.finalFaces ?? [];
    const order = ctx.state.round.scoringOrder ?? faces.map((_, i) => i);
    const scoringFaces = order
      .filter((idx) => idx >= 0 && idx < faces.length)
      .map((i) => faces[i]!);
    const big = scoringFaces.filter((f) => f === 5 || f === 6).length;
    if (big < THRESHOLD) return ctx;
    const newMult = ctx.mult * MULT_VALUE;
    return {
      ...ctx,
      mult: newMult,
      events: emitUpgrade(ctx, 'solar_flare', 0, newMult - ctx.mult),
    };
  },
});
