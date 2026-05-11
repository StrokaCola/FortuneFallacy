// Event Horizon: each stack adds +1% permanent ×mult. Stacks accrue when
// any single die contributes 100+ to a hand. Detection runs in
// actions/handlers/roll.ts SCORE_HAND by walking the per-die mod events.
//
// Reads the cumulative bonus directly so a 20-stack run reads as "+20% mult".
import { register } from '../registry';
import { Phase } from '../../pipeline/types';
import { emitUpgrade } from './_helpers';

const MULT_PER_STACK = 0.01;

register({
  id: 'event_horizon',
  phase: Phase.UPGRADES,
  priority: 92,
  apply: (ctx) => {
    const stacks = ctx.state.run.catalystStacks?.['event_horizon'] ?? 0;
    if (stacks <= 0) return ctx;
    const newMult = ctx.mult * (1 + stacks * MULT_PER_STACK);
    return {
      ...ctx,
      mult: newMult,
      events: emitUpgrade(ctx, 'event_horizon', 0, newMult - ctx.mult),
    };
  },
});
