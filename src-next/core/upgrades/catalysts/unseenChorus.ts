// Unseen Chorus: when there are 3+ unheld dice AND every unheld face is
// a distinct value, x1.5 mult. Rewards spreading your leftovers across
// the face range instead of dumping duplicates.
import { register } from '../registry';
import { Phase } from '../../pipeline/types';
import { emitUpgradePhase, getUnheldFaces } from './_helpers';

register({
  id: 'unseen_chorus',
  phase: Phase.UNHELD_SCAN,
  priority: 21,
  apply: (ctx) => {
    if (!ctx.state.run.catalysts.includes('unseen_chorus')) return ctx;
    const { faces } = getUnheldFaces(ctx);
    if (faces.length < 3) return ctx;
    const seen = new Set<number>();
    for (const f of faces) {
      if (seen.has(f)) return ctx;
      seen.add(f);
    }
    const nextMult = ctx.mult * 1.5;
    return {
      ...ctx,
      mult: nextMult,
      events: emitUpgradePhase(ctx, 'unseen_chorus', Phase.UNHELD_SCAN, 0, nextMult - ctx.mult),
    };
  },
});
