// Prime Resonance: mult is raised to the power 1.05 per scoring die.
// 5 scoring dice (Lyra default): mult^(1.05^5) ≈ mult^1.276 — a ~28%
// power-law boost on the mult axis. Compounds late-blind because
// catalyst stacks already inflated mult.
import { register } from '../registry';
import { Phase } from '../../pipeline/types';
import { emitUpgrade } from './_helpers';

register({
  id: 'prime_resonance',
  phase: Phase.UPGRADES,
  // Run very late in the upgrade pass so it operates on the fully-built mult.
  priority: 180,
  apply: (ctx) => {
    if (!ctx.combo) return ctx;
    const scoringCount = ctx.combo.scoringFaces.length;
    if (scoringCount === 0 || ctx.mult <= 1) return ctx;
    const exponent = Math.pow(1.05, scoringCount);
    const newMult = Math.pow(ctx.mult, exponent);
    return {
      ...ctx,
      mult: newMult,
      events: emitUpgrade(ctx, 'prime_resonance', 0, newMult - ctx.mult),
    };
  },
});
