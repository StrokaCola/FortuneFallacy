// Star Chart: per-catalyst stack accrues when a Straight is scored (small
// or large). Each stack adds +0.25× mult on every subsequent hand.
// Increment is handled in actions/handlers/roll.ts SCORE_HAND (post-combo).
import { register } from '../registry';
import { Phase } from '../../pipeline/types';
import { emitUpgrade } from './_helpers';

const BONUS_PER_STACK = 0.25;

register({
  id: 'star_chart',
  phase: Phase.UPGRADES,
  priority: 82,
  apply: (ctx) => {
    const stacks = ctx.state.run.catalystStacks?.['star_chart'] ?? 0;
    if (stacks <= 0) return ctx;
    const newMult = ctx.mult * (1 + stacks * BONUS_PER_STACK);
    return {
      ...ctx,
      mult: newMult,
      events: emitUpgrade(ctx, 'star_chart', 0, newMult - ctx.mult),
    };
  },
});
