// Streak Seeker: every 4th hand of the run grants ×2 mult. Identical
// shape to Patience Counter (every 5th hand → ×3) but tuned for a more
// frequent, smaller spike — and they stack happily.
import { register } from '../registry';
import { Phase } from '../../pipeline/types';
import { emitUpgrade } from './_helpers';

const TRIGGER_INTERVAL = 4;
const MULT_FACTOR = 2;

register({
  id: 'streak_seeker',
  phase: Phase.UPGRADES,
  // Run alongside other "this hand only" multipliers (patience_counter
  // is at 150; we sit at 145 so the order is deterministic but the
  // exact ordering doesn't matter much — both apply multiplicatively).
  priority: 145,
  apply: (ctx) => {
    // handsPlayed increments AFTER this hand by SCORE_HAND, so the
    // current hand number = handsPlayed + 1 (mirrors patience_counter).
    if ((ctx.state.run.handsPlayed + 1) % TRIGGER_INTERVAL !== 0) return ctx;
    const newMult = ctx.mult * MULT_FACTOR;
    return {
      ...ctx,
      mult: newMult,
      events: emitUpgrade(ctx, 'streak_seeker', 0, newMult - ctx.mult),
    };
  },
});
