// Odd Voice: when EVERY scoring die shows an odd face, mult ×1.5.
// Mirror of even_keeled but on the mult axis.
import { register } from '../registry';
import { Phase } from '../../pipeline/types';
import { emitUpgrade } from './_helpers';

register({
  id: 'odd_voice',
  phase: Phase.UPGRADES,
  priority: 81,
  apply: (ctx) => {
    const faces = ctx.sim?.finalFaces ?? [];
    const order = ctx.state.round.scoringOrder ?? faces.map((_, i) => i);
    const scoringFaces = order
      .filter((idx) => idx >= 0 && idx < faces.length)
      .map((i) => faces[i]!);
    if (scoringFaces.length === 0) return ctx;
    const allOdd = scoringFaces.every((f) => f % 2 === 1);
    if (!allOdd) return ctx;
    const newMult = ctx.mult * 1.5;
    return {
      ...ctx,
      mult: newMult,
      events: emitUpgrade(ctx, 'odd_voice', 0, newMult - ctx.mult),
    };
  },
});
