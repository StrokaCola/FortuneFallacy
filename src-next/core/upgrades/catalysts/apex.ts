// Apex: Five of a Kind → mult ×3, plus +1 mult per scoring die equal to
// the matching face. On a true 5-of-a-kind every scoring die matches the
// face, so the per-die bonus collapses to +scoringFaces.length mult on top
// of the ×3.
import { register } from '../registry';
import { Phase } from '../../pipeline/types';
import { emitUpgrade } from './_helpers';

register({
  id: 'apex',
  phase: Phase.UPGRADES,
  priority: 115,
  apply: (ctx) => {
    if (ctx.combo?.id !== 'five_kind') return ctx;
    const matchingFace = ctx.combo.scoringFaces[0];
    const matchingCount = ctx.combo.scoringFaces.filter((f) => f === matchingFace).length;
    const afterTriple = ctx.mult * 3;
    const final = afterTriple + matchingCount;
    return {
      ...ctx,
      mult: final,
      events: emitUpgrade(ctx, 'apex', 0, final - ctx.mult),
    };
  },
});
