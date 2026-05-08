// First Strike: opens every blind with a heavy spike — fires on the
// first scoring hand of each blind (gated by `round.firstHandPlayed`).
// Sized to be the dedicated "round opener" companion to Lucky Streak
// (which is +30/+3); together they front-load the first hand of each
// blind into a real burst. Buffed 2026-05-08 from once-per-run after
// the impact sweep showed the previous version barely moved the
// needle (Δ +0.6% on Lyra/Spark).
import { register } from '../registry';
import { Phase } from '../../pipeline/types';
import { emitUpgrade } from './_helpers';

const CHIP_BONUS = 50;
const MULT_BONUS = 5;

register({
  id: 'first_strike',
  phase: Phase.UPGRADES,
  priority: 25,
  apply: (ctx) => {
    if (ctx.state.round.firstHandPlayed) return ctx;
    return {
      ...ctx,
      chips: ctx.chips + CHIP_BONUS,
      mult: ctx.mult + MULT_BONUS,
      events: emitUpgrade(ctx, 'first_strike', CHIP_BONUS, MULT_BONUS),
    };
  },
});
