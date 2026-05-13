// Silent Witness: when EVERY unheld die shows an even face (and at least
// two dice are unheld), +10 chips and x1.1 mult. Mirrors Even Keeled for
// the dice the player left out of the scoring set.
import { register } from '../registry';
import { Phase } from '../../pipeline/types';
import { emitUpgradePhase, getUnheldFaces } from './_helpers';

register({
  id: 'silent_witness',
  phase: Phase.UNHELD_SCAN,
  priority: 20,
  apply: (ctx) => {
    if (!ctx.state.run.catalysts.includes('silent_witness')) return ctx;
    const { faces } = getUnheldFaces(ctx);
    if (faces.length < 2) return ctx;
    const allEven = faces.every((f) => f > 0 && f % 2 === 0);
    if (!allEven) return ctx;
    const nextChips = ctx.chips + 10;
    const nextMult = ctx.mult * 1.1;
    return {
      ...ctx,
      chips: nextChips,
      mult: nextMult,
      events: emitUpgradePhase(ctx, 'silent_witness', Phase.UNHELD_SCAN, 10, nextMult - ctx.mult),
    };
  },
});
