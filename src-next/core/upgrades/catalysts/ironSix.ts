// Iron Six: each scoring 6 also gives +1 mult (in addition to Six Bias chips).
// Counts faces in the SCORING set only (matches Six Bias semantics).
import { register } from '../registry';
import { Phase } from '../../pipeline/types';
import { emitUpgrade } from './_helpers';

register({
  id: 'iron_six',
  phase: Phase.UPGRADES,
  priority: 11,
  apply: (ctx) => {
    const faces = ctx.sim?.finalFaces ?? [];
    const order = ctx.state.round.scoringOrder ?? faces.map((_, i) => i);
    const scoringFaces = order
      .filter((idx) => idx >= 0 && idx < faces.length)
      .map((i) => faces[i]!);
    const sixes = scoringFaces.filter((f) => f === 6).length;
    if (sixes === 0) return ctx;
    return {
      ...ctx,
      mult: ctx.mult + sixes,
      events: emitUpgrade(ctx, 'iron_six', 0, sixes),
    };
  },
});
