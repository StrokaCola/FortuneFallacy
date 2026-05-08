// Royal Flush: huge spike on the highest-tier hands — Five of a Kind or
// Large Straight. +200 chips and ×2 mult. Stacks with Apex (five_kind)
// and Magnitude (lg_straight) for run-defining peaks.
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
    if (id !== 'five_kind' && id !== 'lg_straight') return ctx;
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
