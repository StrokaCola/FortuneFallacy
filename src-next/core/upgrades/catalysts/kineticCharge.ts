// Kinetic Charge: +1 chip per collision the dice produced in the tray
// during the physical tumble. Capped at +30 so a runaway-chaos roll
// can't dominate the pipeline.
import { register } from '../registry';
import { Phase } from '../../pipeline/types';
import { emitUpgradePhase } from './_helpers';

const CAP = 30;

register({
  id: 'kinetic_charge',
  phase: Phase.ON_COLLISION,
  priority: 10,
  apply: (ctx) => {
    if (!ctx.state.run.catalysts.includes('kinetic_charge')) return ctx;
    const n = ctx.sim?.collisionCount ?? 0;
    if (n <= 0) return ctx;
    const dChips = Math.min(n, CAP);
    return {
      ...ctx,
      chips: ctx.chips + dChips,
      events: emitUpgradePhase(ctx, 'kinetic_charge', Phase.ON_COLLISION, dChips, 0),
    };
  },
});
