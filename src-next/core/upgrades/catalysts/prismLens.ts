// Prism Lens: any scoring combo grants a flat +25 chips and ×1.5 mult.
// Universal scoring floor — pairs with any combo lane. The "chance" hand
// (no combo at all) does not trigger; the floor only kicks in when the
// player actually formed something.
import { register } from '../registry';
import { Phase } from '../../pipeline/types';
import { emitUpgrade } from './_helpers';

const CHIP_BONUS = 25;
const MULT_FACTOR = 1.5;

register({
  id: 'prism_lens',
  phase: Phase.UPGRADES,
  // Late so the ×1.5 amplifies any earlier additive mults from
  // combo-tribal catalysts (Pair Dynamo, Triplet Engine, etc).
  priority: 130,
  apply: (ctx) => {
    if (!ctx.combo || ctx.combo.id === 'chance') return ctx;
    const newChips = ctx.chips + CHIP_BONUS;
    const newMult = ctx.mult * MULT_FACTOR;
    return {
      ...ctx,
      chips: newChips,
      mult: newMult,
      events: emitUpgrade(ctx, 'prism_lens', CHIP_BONUS, newMult - ctx.mult),
    };
  },
});
