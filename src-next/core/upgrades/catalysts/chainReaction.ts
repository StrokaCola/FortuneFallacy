// Chain Reaction: if the dice collided 15+ times in the tray (a chaotic
// tumble), x1.5 mult once. Threshold tuned to fire on dense rolls but
// stay rare on light rolls (1-2 dice).
import { register } from '../registry';
import { Phase } from '../../pipeline/types';
import { emitUpgradePhase } from './_helpers';

const THRESHOLD = 15;

register({
  id: 'chain_reaction',
  phase: Phase.ON_COLLISION,
  priority: 20,
  apply: (ctx) => {
    if (!ctx.state.run.catalysts.includes('chain_reaction')) return ctx;
    const n = ctx.sim?.collisionCount ?? 0;
    if (n < THRESHOLD) return ctx;
    const nextMult = ctx.mult * 1.5;
    return {
      ...ctx,
      mult: nextMult,
      events: emitUpgradePhase(ctx, 'chain_reaction', Phase.ON_COLLISION, 0, nextMult - ctx.mult),
    };
  },
});
