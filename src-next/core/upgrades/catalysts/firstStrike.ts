// First Strike: a single huge spike on the very first hand of the run.
// Front-loads a clear path through the A1 lesser trial — the fail mode
// the sim flagged as the dominant new-player wall.
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
    if (ctx.state.run.handsPlayed !== 0) return ctx;
    return {
      ...ctx,
      chips: ctx.chips + CHIP_BONUS,
      mult: ctx.mult + MULT_BONUS,
      events: emitUpgrade(ctx, 'first_strike', CHIP_BONUS, MULT_BONUS),
    };
  },
});
