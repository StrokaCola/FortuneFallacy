// Shadow Cache: +3 chips per unheld face >= 5. Pays you for the
// high-value dice you chose to drop (e.g. a non-scoring 6 in a pair hand).
import { register } from '../registry';
import { Phase } from '../../pipeline/types';
import { emitUpgradePhase, getUnheldFaces } from './_helpers';

register({
  id: 'shadow_cache',
  phase: Phase.UNHELD_SCAN,
  priority: 10,
  apply: (ctx) => {
    if (!ctx.state.run.catalysts.includes('shadow_cache')) return ctx;
    const { faces } = getUnheldFaces(ctx);
    let high = 0;
    for (const f of faces) if (f >= 5) high += 1;
    if (high === 0) return ctx;
    const dChips = high * 3;
    return {
      ...ctx,
      chips: ctx.chips + dChips,
      events: emitUpgradePhase(ctx, 'shadow_cache', Phase.UNHELD_SCAN, dChips, 0),
    };
  },
});
