// Bone Tax — each scoring die grants +5 mult, but the catalyst takes a
// 15% bite out of the running chip total before scoring resolves.
// Hard-trade build: heavy mult lifter for builds that already pile
// chips (face-bias / mod-density / combo-tribal), brutal for builds
// that lean on the chip side (Six Bias as a sole strategy).
//
// Priority 95 so the +mult lands after combo-tribal mult mults but
// before final-tier scaling catalysts (Tempo at 110); the chip cut
// resolves at the same tick, mid-build.
import { register } from '../registry';
import { Phase } from '../../pipeline/types';
import { emitUpgrade } from './_helpers';

register({
  id: 'bone_tax',
  phase: Phase.UPGRADES,
  priority: 95,
  apply: (ctx) => {
    const faces = ctx.sim?.finalFaces ?? [];
    const order = ctx.state.round.scoringOrder ?? faces.map((_, i) => i);
    const scoringCount = order.filter((idx) => idx >= 0 && idx < faces.length).length;
    if (scoringCount === 0) return ctx;
    const multGain = scoringCount * 5;
    const chipsBefore = ctx.chips;
    const chipsAfter = Math.floor(chipsBefore * 0.85);
    const chipsLoss = chipsBefore - chipsAfter;
    return {
      ...ctx,
      chips: chipsAfter,
      mult: ctx.mult + multGain,
      events: emitUpgrade(ctx, 'bone_tax', -chipsLoss, multGain),
    };
  },
});
