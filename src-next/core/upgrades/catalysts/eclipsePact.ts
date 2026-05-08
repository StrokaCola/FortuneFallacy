// Eclipse Pact (legendary): every scoring hand gains +50 chips and +5
// mult. Universal floor — combined with anything, intentionally
// always-on, intentionally large. The legendary slot in this pack is
// "you always score more"; pairs with combo/face lanes without
// gating on a specific trigger.
import { register } from '../registry';
import { Phase } from '../../pipeline/types';
import { emitUpgrade } from './_helpers';

const CHIP_BONUS = 50;
const MULT_BONUS = 5;

register({
  id: 'eclipse_pact',
  phase: Phase.UPGRADES,
  // Mid-priority (50) — folds in before late multiplicatives so its
  // additive mult gets amplified by them (prism_lens, royal_flush,
  // nova_burst, etc).
  priority: 50,
  apply: (ctx) => {
    return {
      ...ctx,
      chips: ctx.chips + CHIP_BONUS,
      mult: ctx.mult + MULT_BONUS,
      events: emitUpgrade(ctx, 'eclipse_pact', CHIP_BONUS, MULT_BONUS),
    };
  },
});
