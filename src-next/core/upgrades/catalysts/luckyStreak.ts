// Lucky Streak: opener bonus on the first scoring hand of each round.
// Pairs with First Strike for a stacked round-1 burst on the first
// blind of a run.
import { register } from '../registry';
import { Phase } from '../../pipeline/types';
import { emitUpgrade } from './_helpers';

const CHIP_BONUS = 30;
const MULT_BONUS = 3;

register({
  id: 'lucky_streak',
  phase: Phase.UPGRADES,
  priority: 30,
  apply: (ctx) => {
    if (ctx.state.round.firstHandPlayed) return ctx;
    return {
      ...ctx,
      chips: ctx.chips + CHIP_BONUS,
      mult: ctx.mult + MULT_BONUS,
      events: emitUpgrade(ctx, 'lucky_streak', CHIP_BONUS, MULT_BONUS),
    };
  },
});
