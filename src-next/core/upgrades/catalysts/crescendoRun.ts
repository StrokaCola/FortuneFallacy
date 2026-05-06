// Crescendo Run: ×2 mult when the player has rolled 3+ times this round
// without locking any die. The counter (round.rollsWithoutLock) advances
// on ROLL_REQUESTED + REROLL_REQUESTED and resets on TOGGLE_LOCK that
// LOCKS a new die.
//
// Pairs with high-variance constellations (Mensa, Polyhedra) where wide
// rerolls are the natural play; punishes lock-then-reroll discipline.
import { register } from '../registry';
import { Phase } from '../../pipeline/types';
import { emitUpgrade } from './_helpers';

const ROLL_THRESHOLD = 3;

register({
  id: 'crescendo_run',
  phase: Phase.UPGRADES,
  priority: 140,
  apply: (ctx) => {
    const rolls = ctx.state.round.rollsWithoutLock ?? 0;
    if (rolls < ROLL_THRESHOLD) return ctx;
    const newMult = ctx.mult * 2;
    return {
      ...ctx,
      mult: newMult,
      events: emitUpgrade(ctx, 'crescendo_run', 0, newMult - ctx.mult),
    };
  },
});
