// Reservoir: +1 chip per pip on every unheld die. Smooth scaling on
// whatever the player didn't put into the scoring set.
import { register } from '../registry';
import { Phase } from '../../pipeline/types';
import { emitUpgradePhase, getUnheldFaces } from './_helpers';

register({
  id: 'reservoir',
  phase: Phase.UNHELD_SCAN,
  priority: 11,
  apply: (ctx) => {
    if (!ctx.state.run.catalysts.includes('reservoir')) return ctx;
    const { faces } = getUnheldFaces(ctx);
    if (faces.length === 0) return ctx;
    let sum = 0;
    for (const f of faces) if (f > 0) sum += f;
    if (sum === 0) return ctx;
    return {
      ...ctx,
      chips: ctx.chips + sum,
      events: emitUpgradePhase(ctx, 'reservoir', Phase.UNHELD_SCAN, sum, 0),
    };
  },
});
