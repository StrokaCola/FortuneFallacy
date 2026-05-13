// Kindred Clatter: +3 mult per collision pair where BOTH dice ended on
// the same face value (e.g. two 6s that clacked into each other and both
// landed showing 6). Uses the intrinsic roll outcome — face values are
// fixed by the time physics finishes, so this is independent of the
// player's later scoring choice. Each unordered pair is counted once.
import { register } from '../registry';
import { Phase } from '../../pipeline/types';
import { emitUpgradePhase } from './_helpers';

register({
  id: 'kindred_clatter',
  phase: Phase.ON_COLLISION,
  priority: 30,
  apply: (ctx) => {
    if (!ctx.state.run.catalysts.includes('kindred_clatter')) return ctx;
    const pairs = ctx.sim?.collisionPairs;
    const faces = ctx.sim?.finalFaces;
    if (!pairs || !faces || pairs.length === 0) return ctx;
    // Dedupe to unordered pairs — rapier can fire the same touch twice
    // and a long contact can re-fire each step. Count each unordered
    // (a,b) at most once per roll.
    const seen = new Set<string>();
    let matches = 0;
    for (const [a, b] of pairs) {
      if (a === b) continue;
      const fa = faces[a];
      const fb = faces[b];
      if (fa == null || fb == null) continue;
      if (fa !== fb) continue;
      const lo = a < b ? a : b;
      const hi = a < b ? b : a;
      const key = `${lo}:${hi}`;
      if (seen.has(key)) continue;
      seen.add(key);
      matches += 1;
    }
    if (matches === 0) return ctx;
    const dMult = matches * 3;
    return {
      ...ctx,
      mult: ctx.mult + dMult,
      events: emitUpgradePhase(ctx, 'kindred_clatter', Phase.ON_COLLISION, 0, dMult),
    };
  },
});
