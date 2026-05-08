// Royal Flush: huge spike on the high-tier hands — Four of a Kind, Five
// of a Kind, or Large Straight. +200 chips and ×2 mult. Stacks with Apex
// (five_kind), Tetrad (four_kind), and Magnitude (lg_straight) for
// run-defining peaks. Buffed 2026-05-08 to include four_kind in the
// trigger list after the impact sweep showed five-kind / lg-straight
// alone fired ~0% under the no-buy bot (Δ +0.1%).
import { register } from '../registry';
import { Phase } from '../../pipeline/types';
import { emitUpgrade } from './_helpers';

const CHIP_BONUS = 200;
const MULT_FACTOR = 2;

register({
  id: 'royal_flush',
  phase: Phase.UPGRADES,
  // Sit just above magnitude (110) so the flat chips fold in before the
  // ×2 mult, giving a clean burst when both fire.
  priority: 120,
  apply: (ctx) => {
    const id = ctx.combo?.id;
    if (id !== 'four_kind' && id !== 'five_kind' && id !== 'lg_straight') return ctx;
    const newChips = ctx.chips + CHIP_BONUS;
    const newMult = ctx.mult * MULT_FACTOR;
    return {
      ...ctx,
      chips: newChips,
      mult: newMult,
      events: emitUpgrade(ctx, 'royal_flush', CHIP_BONUS, newMult - ctx.mult),
    };
  },
});
