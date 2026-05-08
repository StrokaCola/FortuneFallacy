// Nova Burst: snowballs harder the deeper the run goes. Multiplies mult
// by (1 + ante × 0.4). At ante 1 → ×1.4, ante 4 (final) → ×2.6.
// Synergizes with Compounding Bias / Momentum to make late antes the
// big-payout zone the targets demand.
import { register } from '../registry';
import { Phase } from '../../pipeline/types';
import { emitUpgrade } from './_helpers';

const PER_ANTE = 0.4;

register({
  id: 'nova_burst',
  phase: Phase.UPGRADES,
  // Run late (160) so it amplifies the rest of the stack. Sits above
  // patience_counter / streak_seeker so all three compose in a
  // predictable order.
  priority: 160,
  apply: (ctx) => {
    const ante = ctx.state.run.ante;
    if (ante <= 0) return ctx;
    const factor = 1 + ante * PER_ANTE;
    const newMult = ctx.mult * factor;
    return {
      ...ctx,
      mult: newMult,
      events: emitUpgrade(ctx, 'nova_burst', 0, newMult - ctx.mult),
    };
  },
});
