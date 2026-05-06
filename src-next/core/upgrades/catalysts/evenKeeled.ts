// Even Keeled: when EVERY scoring die shows an even face, chips ×1.5.
// Skips silently if scoringFaces is empty (degenerate hand).
import { register } from '../registry';
import { Phase } from '../../pipeline/types';
import { emitUpgrade } from './_helpers';

register({
  id: 'even_keeled',
  phase: Phase.UPGRADES,
  priority: 80,
  apply: (ctx) => {
    const faces = ctx.sim?.finalFaces ?? [];
    const order = ctx.state.round.scoringOrder ?? faces.map((_, i) => i);
    const scoringFaces = order
      .filter((idx) => idx >= 0 && idx < faces.length)
      .map((i) => faces[i]!);
    if (scoringFaces.length === 0) return ctx;
    const allEven = scoringFaces.every((f) => f % 2 === 0);
    if (!allEven) return ctx;
    const newChips = ctx.chips * 1.5;
    return {
      ...ctx,
      chips: newChips,
      events: emitUpgrade(ctx, 'even_keeled', newChips - ctx.chips, 0),
    };
  },
});
